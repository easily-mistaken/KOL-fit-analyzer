import { Prisma, prisma } from "@kol-fit/db";

export interface CacheEntry {
  payload: unknown;
  fetchedAt: Date;
}

/** Minimal cache surface. Implementations may throw; callers (the decorator)
 *  treat any error as a miss/no-op so caching never fails an analysis. */
export interface CacheStore {
  /** Returns null when absent or expired. */
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, payload: unknown, ttlSeconds: number): Promise<void>;
}

/** In-memory store for tests/local dev. Injectable clock for TTL tests. */
export class InMemoryCacheStore implements CacheStore {
  private readonly map = new Map<
    string,
    { payload: unknown; fetchedAt: Date; expiresAt: number }
  >();
  constructor(private readonly now: () => Date = () => new Date()) {}

  async get(key: string): Promise<CacheEntry | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt <= this.now().getTime()) {
      this.map.delete(key);
      return null;
    }
    return { payload: e.payload, fetchedAt: e.fetchedAt };
  }

  async set(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
    const now = this.now();
    this.map.set(key, {
      payload,
      fetchedAt: now,
      expiresAt: now.getTime() + ttlSeconds * 1000,
    });
  }
}

/** Postgres-backed store using the ProviderCache table. Expired rows are
 *  deleted lazily on a read miss to keep the table bounded. */
export class PrismaCacheStore implements CacheStore {
  constructor(
    private readonly provider: string,
    private readonly client = prisma
  ) {}

  async get(key: string): Promise<CacheEntry | null> {
    const row = await this.client.providerCache.findUnique({ where: { key } });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.client.providerCache.delete({ where: { key } }).catch(() => {});
      return null;
    }
    return { payload: row.payload, fetchedAt: row.fetchedAt };
  }

  async set(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
    const data = {
      provider: this.provider,
      payload: payload as Prisma.InputJsonValue,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
    await this.client.providerCache.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
  }
}

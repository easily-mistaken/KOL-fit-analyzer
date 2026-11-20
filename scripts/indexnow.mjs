#!/usr/bin/env node
// Tell IndexNow engines (Bing, which also feeds ChatGPT search and Copilot,
// plus Yandex, Seznam, Naver) that the site's pages changed, so new or edited
// pages are recrawled within hours instead of weeks. Google ignores IndexNow;
// it reads the sitemap.
//
// Usage, after a deploy that adds or changes public pages:
//   node scripts/indexnow.mjs            # every URL in the live sitemap
//   node scripts/indexnow.mjs /launch-videos /work   # just these paths
//
// The key is the file name in apps/web/public/ (served at /<key>.txt), which
// proves to the engines that we own the host.

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "overlapx.com";
const ORIGIN = `https://${HOST}`;
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/public");

const keyFile = readdirSync(publicDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error("No IndexNow key file (32 hex chars + .txt) in apps/web/public.");
  process.exit(1);
}
const key = keyFile.replace(/\.txt$/, "");

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

let urls = process.argv
  .slice(2)
  .map((p) => (p.startsWith("http") ? p : `${ORIGIN}${p.startsWith("/") ? p : `/${p}`}`));
if (urls.length === 0) {
  const sitemap = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!sitemap.ok) {
    console.error(`Could not fetch the sitemap: ${sitemap.status}`);
    process.exit(1);
  }
  const xml = await sitemap.text();
  // Page <loc>s only: video sitemap entries nest their own URLs in other tags.
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1])).filter((u) => u.startsWith(ORIGIN));
}
urls = [...new Set(urls)].filter((u) => u.startsWith(ORIGIN));
if (urls.length === 0) {
  console.error("No overlapx.com URLs to submit.");
  process.exit(1);
}

const live = await fetch(`${ORIGIN}/${keyFile}`);
if (!live.ok || (await live.text()).trim() !== key) {
  console.error(`${ORIGIN}/${keyFile} is not live yet; deploy first.`);
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${keyFile}`, urlList: urls }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} URLs`);
if (res.status >= 400) {
  console.error(await res.text());
  process.exit(1);
}

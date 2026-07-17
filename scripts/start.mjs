#!/usr/bin/env node
// One-container production start: runs the Next.js web server and the pg-boss
// worker as two child processes in a single deployable service. If either exits,
// the whole process exits so the platform restarts the container — no silent
// half-up state where the web serves but jobs never run (or vice versa).
//
// Local development still uses two terminals (`pnpm dev:web` / `pnpm dev:worker`).
// This is the `pnpm start` used by the deploy host (Railway/Render/Fly/any
// always-on container). Dependency-free and portable — plain Node, no bash.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// For local `pnpm start`, load the repo-root .env — but NEVER override real
// platform env (production injects vars straight into the environment and has no
// .env file). Both children inherit the resulting process.env.
try {
  for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // No .env (e.g. production) — the platform's env is already in process.env.
}

const services = [
  { name: "worker", cmd: "node", args: ["apps/worker/dist/index.js"] },
  { name: "web", cmd: "pnpm", args: ["--filter", "web", "start"] },
];

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  // Failsafe: hard-exit if a child ignores SIGTERM.
  setTimeout(() => process.exit(code), 5000).unref();
}

for (const { name, cmd, args } of services) {
  const child = spawn(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
  children.push(child);
  child.on("exit", (code, signal) => {
    console.error(
      `[start] "${name}" exited (code=${code ?? "null"}, signal=${signal ?? "null"}); stopping the container`
    );
    shutdown(code ?? 1);
  });
  child.on("error", (err) => {
    console.error(`[start] "${name}" failed to spawn: ${err.message}`);
    shutdown(1);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[start] received ${sig}; forwarding to children`);
    shutdown(0);
  });
}

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Detect base directory: project root (dev) or exe directory (pkg)
declare var __dirname: string | undefined;
const BASE_DIR = (() => {
  if (typeof __dirname !== "undefined" && !__dirname.startsWith("/snapshot/")) return __dirname;
  // @ts-ignore TS1343 — valid in ESM
  if (typeof __dirname === "undefined") return path.dirname(fileURLToPath(import.meta.url));
  return path.dirname(process.execPath); // pkg: views/ and .env are next to the exe
})();

// Load .env from the right directory
dotenv.config({ path: path.join(BASE_DIR, ".env") });

// Ensure data directory exists and set absolute DB path (pkg-compatible)
const dataDir = path.join(BASE_DIR, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
process.env.DATABASE_URL ||= `file:${path.join(dataDir, "trackly.db")}`;

export { BASE_DIR };

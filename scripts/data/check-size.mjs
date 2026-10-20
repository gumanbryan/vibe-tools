import { stat, readdir } from "node:fs/promises";
import { checkSize } from "./data-core.mjs";
async function size(path) {
  let total = 0;
  for (const e of await readdir(path, { withFileTypes: true })) {
    const p = path + "/" + e.name;
    total += e.isDirectory() ? await size(p) : (await stat(p)).size;
  }
  return total;
}
const path = process.argv.includes("--site")
  ? process.argv[process.argv.indexOf("--site") + 1]
  : "dist";
const bytes = await size(path),
  r = checkSize(bytes);
console.log(
  JSON.stringify({
    path,
    bytes,
    megabytes: (bytes / 1024 ** 2).toFixed(2),
    ...r,
  }),
);
if (!r.ok) process.exitCode = 1;

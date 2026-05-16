import sharp from "sharp";
import { renameSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("public/authors/glover.png");
const tmp = resolve("public/authors/glover.optimized.png");

const beforeBytes = statSync(src).size;

await sharp(src)
  .resize(800, 800, { fit: "inside", withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true, quality: 80 })
  .toFile(tmp);

const afterBytes = statSync(tmp).size;

unlinkSync(src);
renameSync(tmp, src);

const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`glover.png: ${fmt(beforeBytes)} → ${fmt(afterBytes)}`);

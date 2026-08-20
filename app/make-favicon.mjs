// Generate the Casrose favicon: solid gold circle + the real rose motif knocked
// out in cream. Flat — no gradient, no glow (those need >=80px to read; a favicon
// renders at 16-32px). Emits a multi-size .ico plus an SVG for modern browsers.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import pngToIco from "png-to-ico";

// Read the motif straight out of the TypeScript source so there is no generated
// .js copy to keep in sync — emblem.ts stays the single source of the real path.
const emblemSrc = readFileSync("src/emblem.ts", "utf8");
const pathStart = emblemSrc.indexOf('EMBLEM_MOTIF_PATH');
const q1 = emblemSrc.indexOf('"', pathStart);
const q2 = emblemSrc.indexOf('"', q1 + 1);
const EMBLEM_MOTIF_PATH = pathStart < 0 || q1 < 0 || q2 < 0 ? null : emblemSrc.slice(q1 + 1, q2);
if (!EMBLEM_MOTIF_PATH) throw new Error("could not read EMBLEM_MOTIF_PATH from src/emblem.ts");

mkdirSync("dist-single", { recursive: true });

const GOLD = "#B3905E"; // Design Reference gold
const CREAM = "#F1E2CC"; // approved emblem inner stroke colour

// viewBox 0 0 320 320, circle cx/cy 160 r 160 — full-bleed so the mark fills the tile.
// Primary mark — full rose motif. Reads from ~32px up.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
  <circle cx="160" cy="160" r="160" fill="${GOLD}"/>
  <path d="${EMBLEM_MOTIF_PATH}" fill="${CREAM}"/>
</svg>`;

// Reduced mark — plain circle + cream ring. Used at 16px, where the illustrated
// detail stops resolving (Logo Guideline §3: below minimum size, use the reduced mark).
const svgReduced = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
  <circle cx="160" cy="160" r="160" fill="${GOLD}"/>
  <circle cx="160" cy="160" r="132" fill="none" stroke="${CREAM}" stroke-width="26"/>
</svg>`;

writeFileSync("dist-single/favicon.svg", svg);

const buffers = [];
for (const size of [16, 32, 48]) {
  const art = size <= 16 ? svgReduced : svg;
  buffers.push(await sharp(Buffer.from(art)).resize(size, size).png().toBuffer());
}
writeFileSync("dist-single/favicon.ico", await pngToIco(buffers));

writeFileSync(
  "dist-single/apple-touch-icon.png",
  await sharp(Buffer.from(svg)).resize(180, 180).png().toBuffer()
);

console.log("wrote favicon.svg, favicon.ico (16 reduced / 32 / 48), apple-touch-icon.png");

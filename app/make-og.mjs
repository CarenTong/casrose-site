// Generates og-image.png: the 1200x630 card shown when the site is pasted into
// WhatsApp, iMessage, Slack, LinkedIn and so on.
//
// No text is drawn here on purpose. Link-preview clients render og:title and
// og:description as real text beside the image, so baking words in would only
// duplicate them at whatever size the client chooses to crop to. It also keeps
// the card free of any font dependency, which matters because the build runs on
// a Linux CI box that does not have Cormorant Garamond or Jost installed.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const emblemSrc = readFileSync("src/emblem.ts", "utf8");
const q1 = emblemSrc.indexOf('"', emblemSrc.indexOf("EMBLEM_MOTIF_PATH"));
const q2 = emblemSrc.indexOf('"', q1 + 1);
const MOTIF = emblemSrc.slice(q1 + 1, q2);
if (!MOTIF) throw new Error("could not read EMBLEM_MOTIF_PATH from src/emblem.ts");

const W = 1200;
const H = 630;
const EMBLEM = 300; // drawn size of the mark
const VB = 320; // emblem.ts viewBox is 0 0 320 320

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F4D9A8"/>
      <stop offset="55%" stop-color="#D4964F"/>
      <stop offset="100%" stop-color="#9B4F29"/>
    </linearGradient>
    <radialGradient id="topLeft" cx="0" cy="0" r="1">
      <stop offset="0%" stop-color="#9B4F29" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#9B4F29" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bottomRight" cx="1" cy="1" r="1">
      <stop offset="0%" stop-color="#B3905E" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#B3905E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#D4964F" stop-opacity="0.42"/>
      <stop offset="60%" stop-color="#D4964F" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#D4964F" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#14110e"/>
  <rect width="${W}" height="${H}" fill="url(#topLeft)"/>
  <rect width="${W}" height="${H}" fill="url(#bottomRight)"/>

  <!-- soft glow behind the mark, drawn as a gradient rather than a blur filter
       because filter support in the SVG rasteriser is less dependable -->
  <circle cx="${W / 2}" cy="${H / 2}" r="290" fill="url(#halo)"/>

  <g transform="translate(${W / 2 - EMBLEM / 2}, ${H / 2 - EMBLEM / 2}) scale(${EMBLEM / VB})">
    <circle cx="160" cy="160" r="155" fill="none" stroke="url(#gold)" stroke-width="3.5" opacity="0.9"/>
    <path d="${MOTIF}" fill="url(#gold)" opacity="0.95"/>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg))
  .png({ quality: 90, compressionLevel: 9 })
  .toBuffer();

writeFileSync("../og-image.png", png);
console.log(`og-image.png written: ${W}x${H}, ${(png.length / 1024).toFixed(0)} KB`);

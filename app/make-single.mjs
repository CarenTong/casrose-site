// Bundle dist/ into ONE self-contained index.html:
// CSS + JS inlined, fonts embedded as data: URIs.
// Removes any dependency on an assets/ folder, so deployment is a single-file upload.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assets = join(dist, "assets");
const files = readdirSync(assets);

const jsName = files.find((f) => f.endsWith(".js"));
const cssName = files.find((f) => f.endsWith(".css"));

let css = readFileSync(join(assets, cssName), "utf8");
const js = readFileSync(join(assets, jsName), "utf8");
let html = readFileSync(join(dist, "index.html"), "utf8");

// Inline every font reference as a data: URI. Drop the .woff fallbacks —
// every browser that runs this component supports woff2, and keeping both
// would nearly double the file for no benefit.
const mime = { woff2: "font/woff2", woff: "font/woff" };
let inlined = 0;
css = css.replace(/url\(\.\/([^)]+?\.(woff2|woff))\)/g, (m, file, ext) => {
  const buf = readFileSync(join(assets, file));
  inlined++;
  return `url(data:${mime[ext]};base64,${buf.toString("base64")})`;
});
// remove now-redundant woff (non-woff2) sources to keep the file lean
css = css.replace(/,url\(data:font\/woff;base64,[^)]+\) format\("woff"\)/g, "");

// NOTE: replacement must be a FUNCTION, not a string. The bundles contain
// "$&" (and friends), which String.replace would expand as match references
// and corrupt the output.
html = html
  .replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+"><\/script>/,
    () => `<script type="module">\n${js}\n</script>`
  )
  .replace(
    /<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+">/,
    () => `<style>\n${css}\n</style>`
  );

// Inline the favicons too, so deployment stays a single-file upload.
// The .ico carries three sizes (16px uses the reduced plain-circle mark, 32/48 the
// full rose) — a lone SVG favicon can't switch art by rendered size, so .ico wins here.
try {
  const ico = readFileSync(join("dist-single", "favicon.ico")).toString("base64");
  const touch = readFileSync(join("dist-single", "apple-touch-icon.png")).toString("base64");
  const links =
    `    <link rel="icon" href="data:image/x-icon;base64,${ico}" sizes="16x16 32x32 48x48">\n` +
    `    <link rel="apple-touch-icon" href="data:image/png;base64,${touch}">\n`;
  html = html.replace("</head>", () => links + "  </head>");
  console.log("favicons inlined: yes");
} catch {
  console.log("favicons inlined: NO (run make-favicon.mjs first)");
}

mkdirSync("dist-single", { recursive: true });
writeFileSync(join("dist-single", "index.html"), html);

console.log("fonts inlined:", inlined);
console.log("no asset refs left:", !/\.\/assets\//.test(html));
console.log("size:", (Buffer.byteLength(html) / 1024).toFixed(0) + " KB");

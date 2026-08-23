# casrose.co.uk

The live Casrose site: a dark, cursor-reactive "Midnight Rose" hero with a
contact form.

## How deployment works

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site from
the source in `/app`, uploads it to Hostinger over FTP, then fetches
casrose.co.uk to confirm the hero is actually being served.

What ends up in `public_html`:

| File | Source |
|---|---|
| `index.html` | **built in CI** from `/app` — one self-contained file with JS, CSS, fonts and favicon inlined |
| `og-image.png` | **built in CI** by `app/make-og.mjs` — the link-preview card |
| `.htaccess` | committed |
| `contact.php` | committed — the contact form endpoint |
| `privacy.html`, `terms.html`, `data-deletion.html` | committed — hand-written legal pages |
| `robots.txt`, `sitemap.xml` | committed |

> **The built `index.html` is not committed.** It is regenerated on every deploy
> and git-ignored. Committing it meant two open branches each produced a
> different 320KB minified file, which git cannot merge, so every pair of PRs
> conflicted.
>
> The trade-off: there is no built file in the repo to inspect, and no
> break-glass copy. If Actions is ever unavailable, run the build locally and
> upload `index.html` by hand.

`/app` holds the Vite + React source and is blocked from being served by
`.htaccess`.

## Making a change

Edit the source in `app/src` and commit **only the source** — CI does the rest.

```bash
cd app
npm install          # first time only
npm run dev          # hot-reloading dev server
npm run site         # full production build -> ../index.html
node make-og.mjs     # regenerate the link-preview card
```

`npm run site` writes the built file to the repo root exactly as CI does, so you
can open it to check the real output. It is git-ignored and will never be
committed.

## Link previews and search results

The title, one-line description and preview image all live in `app/index.html`
as `<title>`, `<meta name="description">` and Open Graph tags. Change them there
and rebuild.

`og:image` must stay an absolute URL to a real hosted file. Preview scrapers do
not follow `data:` URIs, which is why that one asset is external while
everything else on the page is inlined.

Each meta tag is deliberately kept on a single line: some scrapers parse with
line-based regexes rather than a real HTML parser and miss tags split across
lines.

## Brand note

The glowing gradient emblem is the **Motion / Digital Glow** treatment (Logo
Usage Guideline v1.1 §4.1) and is valid only on live interactive surfaces. Do not
reuse it for static touchpoints — email signatures, social avatars, print. The
favicon uses a flat gold mark and drops to the plain reduced circle at 16px.

# casrose.co.uk

The live Casrose site: a dark, cursor-reactive "Midnight Rose" hero.

## How deployment works

Hostinger's Git deployment pulls this repository into `public_html`, so **the repo
root is the website**. `index.html` at the root is the entire site — a single
self-contained file with the JavaScript, CSS, fonts and favicon all inlined.

`/app` holds the Vite + React source that *builds* that file. It is committed for
history and future work, and blocked from being served by `.htaccess`.

## Making a change

```bash
cd app
npm install          # first time only
npm run build        # -> app/dist
node make-favicon.mjs
node make-single.mjs # -> app/dist-single/index.html
cp dist-single/index.html ../index.html
```

Then commit **both** the source change and the rebuilt root `index.html`, and push.
Hostinger deploys on push (or via the Deploy button in hPanel → Git).

> The root `index.html` is a build artifact that is deliberately committed:
> Hostinger's shared hosting cannot run a build step, so the built file has to be
> in the repo.

## Brand note

The glowing gradient emblem is the **Motion / Digital Glow** treatment (Logo Usage
Guideline v1.1 §4.1) and is valid only on live interactive surfaces. Do not reuse it
for static touchpoints — email signatures, social avatars, print. The favicon here
uses a flat gold mark, and drops to the plain reduced circle at 16px.

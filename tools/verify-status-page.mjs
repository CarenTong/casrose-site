// Guard reliable-roofing.html — the page Sam Sherwood reads at
// https://casrose.co.uk/reliable-roofing
//
// A weekly unattended agent edits this page and merges its own PR. The deploy
// proves the page returns 200; it cannot tell whether the graph still makes
// sense or whether the wording drifted. This does.
//
// Everything here is offline and deterministic, so it runs as a required check
// on every pull request without reaching the bot repo or the network.
//
//   node tools/verify-status-page.mjs [--update-copy]
//
// --update-copy rewrites the copy snapshot. That is a deliberate human act:
// it is how approved wording changes, and it should never appear in an
// unattended run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// PAGE_PATH exists so the guard can be pointed at a deliberately broken copy
// and proved to fail. A control nobody has watched fail is not a control.
const PAGE = process.env.PAGE_PATH || path.join(HERE, '..', 'reliable-roofing.html');
const SNAPSHOT = path.join(HERE, 'status-page-copy.txt');

const UPDATE = process.argv.includes('--update-copy');
const WORD_LIMIT = 500;
const SHIPPED_POINTS = 6;
const COMING_POINTS = 6;

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

if (!fs.existsSync(PAGE)) {
  console.error('verify-status-page: reliable-roofing.html is missing.');
  process.exit(1);
}
const src = fs.readFileSync(PAGE, 'utf8');

// --------------------------------------------------------------- structure

check(/^<!doctype html>/i.test(src.trim()),
  'the page has no doctype, so browsers will render it in quirks mode');

check(/<meta name="robots" content="noindex/.test(src),
  'the noindex meta tag is gone — the page would become listable in search results');

check(/data-count="\d+">0<\/span><\/div><div class="k">checks before each change/.test(src),
  'the "checks before each change" counter is missing or its markup changed');
check(/data-count="\d+">0<\/span><\/div><div class="k">decisions written down/.test(src),
  'the "decisions written down" counter is missing or its markup changed');

// The two counted figures also appear in the footer prose. If they ever
// disagree the page contradicts itself in front of the reader.
const counterScenarios = (src.match(/data-count="(\d+)">0<\/span><\/div><div class="k">checks before each change/) || [])[1];
const footerScenarios = (src.match(/(\d+) checks pass before any change reaches your phone/) || [])[1];
check(counterScenarios && counterScenarios === footerScenarios,
  `the scenario count disagrees with itself: counter says ${counterScenarios}, footer says ${footerScenarios}`);

const counterAdrs = (src.match(/data-count="(\d+)">0<\/span><\/div><div class="k">decisions written down/) || [])[1];
const footerAdrs = (src.match(/(\d+) decisions written down\./) || [])[1];
check(counterAdrs && counterAdrs === footerAdrs,
  `the decision count disagrees with itself: counter says ${counterAdrs}, footer says ${footerAdrs}`);

// --------------------------------------------------------------- the graph

const starts = [...src.matchAll(/<g class="pt[^"]*"/g)];
const shipped = starts.filter(m => m[0].indexOf('soon') === -1).length;
const coming = starts.length - shipped;
check(shipped === SHIPPED_POINTS,
  `the graph has ${shipped} shipped points, expected ${SHIPPED_POINTS}`);
check(coming === COMING_POINTS,
  `the graph has ${coming} coming points, expected ${COMING_POINTS}`);

// Every point needs its whole apparatus. A half-rewritten point is exactly what
// a bad automated edit produces, and it renders as a floating orb with no label.
const svgStart = src.indexOf('<svg class="tl"');
const svgEnd = src.indexOf('</svg>', svgStart);
if (svgStart < 0 || svgEnd < 0) {
  problems.push('the timeline graph is missing entirely');
} else {
  const graph = src.slice(svgStart, svgEnd);
  const bounds = [...graph.matchAll(/<g class="pt[^"]*"/g)].map(m => m.index);
  bounds.forEach((from, i) => {
    const block = graph.slice(from, i + 1 < bounds.length ? bounds[i + 1] : graph.length);
    const label = (block.match(/<text class="ptlab"[^>]*>([^<]*)</) || [])[1] || `#${i + 1}`;
    check((block.match(/<line class="stem"/g) || []).length === 1, `point "${label}" has no stem`);
    check((block.match(/<circle class="orb"/g) || []).length === 1, `point "${label}" has no orb`);
    check((block.match(/<g class="emi"/g) || []).length === 1, `point "${label}" has no emblem`);
    check((block.match(/<text class="ptlab"/g) || []).length === 2, `point "${label}" does not have two label lines`);

    // The emblem is drawn at translate(cx-10, cy-10). If that drifts from the
    // orb, the icon floats away from its own circle.
    const cx = Number((block.match(/<circle class="orb" cx="(-?\d+)"/) || [])[1]);
    const tx = Number((block.match(/<g class="emi" transform="translate\((-?\d+),/) || [])[1]);
    check(Number.isFinite(cx) && Number.isFinite(tx) && tx === cx - 10,
      `point "${label}": its emblem sits at ${tx} but its orb is at ${cx}, so the icon is off its circle`);

    // Labels must sit under their own point.
    const labelXs = [...block.matchAll(/<text class="ptlab" x="(-?\d+)"/g)].map(m => Number(m[1]));
    check(labelXs.every(x => x === cx), `point "${label}": its labels are not under its orb`);

    // Nothing may wander outside the drawing.
    check(cx >= 0 && cx <= 1000, `point "${label}" is at x=${cx}, outside the graph`);
  });
}

// ------------------------------------------------------------- word budget

function visibleWords(html) {
  const t = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return t.split(/\s+/).filter(w => /[A-Za-z0-9£]/.test(w));
}
const words = visibleWords(src).length;
check(words <= WORD_LIMIT,
  `the page is ${words} visible words, over the agreed limit of ${WORD_LIMIT}`);

// -------------------------------------------------------------- copy freeze

// The wording was agreed with Caren and is not an automation's to change.
// Figures and dates are expected to move every week, so they are normalised
// away; the axis month labels are generated furniture and are dropped whole.
function normalisedCopy(html) {
  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'
    + '|Jan|Feb|Mar|Apr|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  return visibleWords(
    html
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<text class="akey"[^>]*>[\s\S]*?<\/text>/g, ' ')
  ).join(' ')
    .replace(new RegExp('\\b(' + MONTHS + ')\\b', 'g'), 'M')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

const copy = normalisedCopy(src);

if (UPDATE) {
  fs.writeFileSync(SNAPSHOT, copy + '\n');
  console.log('verify-status-page: copy snapshot updated (' + copy.length + ' chars).');
  console.log('This is a deliberate wording change. Say so in the commit message.');
  process.exit(0);
}

if (!fs.existsSync(SNAPSHOT)) {
  problems.push('the copy snapshot is missing; run with --update-copy to create it');
} else {
  const expected = fs.readFileSync(SNAPSHOT, 'utf8').trim();
  if (copy !== expected) {
    // Show where it diverged rather than dumping two paragraphs.
    const a = expected.split(' ');
    const b = copy.split(' ');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    problems.push(
      'the wording changed, and the wording is not an automation\'s to change.\n'
      + '    approved: ...' + a.slice(Math.max(0, i - 6), i + 6).join(' ') + '...\n'
      + '    found:    ...' + b.slice(Math.max(0, i - 6), i + 6).join(' ') + '...\n'
      + '    If this change is intended, run: node tools/verify-status-page.mjs --update-copy'
    );
  }
}

// ------------------------------------------------------------------ verdict

if (problems.length) {
  console.error('verify-status-page: ' + problems.length + ' problem(s) with reliable-roofing.html\n');
  problems.forEach(p => console.error('  - ' + p));
  console.error('\nNothing was changed. This page is client-facing; fix it before it deploys.');
  process.exit(1);
}

console.log('verify-status-page: OK');
console.log('  ' + shipped + ' shipped points, ' + coming + ' coming, all intact');
console.log('  ' + words + ' of ' + WORD_LIMIT + ' visible words');
console.log('  figures agree: ' + counterScenarios + ' checks, ' + counterAdrs + ' decisions');
console.log('  wording matches the approved snapshot');

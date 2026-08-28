// Refresh reliable-roofing.html — the status page Sam Sherwood reads at
// https://casrose.co.uk/reliable-roofing
//
// WHY THIS IS A SCRIPT AND NOT A PROMPT
// A weekly unattended agent updates this page and merges its own PR. Asking a
// model to hand-edit thirty-odd SVG coordinates each week and then approve its
// own work is the one failure the deploy cannot catch: the live check proves the
// page returns 200, not that the graph still makes sense. So every mechanical
// edit lives here, deterministic and re-runnable, and the agent only runs it and
// reads the report.
//
// It refuses to write rather than write something wrong. Every guard below turns
// a bad refresh into a loud failure instead of a quiet deploy.
//
//   node tools/refresh-status-page.mjs [--check]
//
// --check reports what would change and writes nothing.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'reliable-roofing.html');
const BOT_REPO = process.env.BOT_REPO
  || 'C:\\Users\\Caren\\projects\\whatsapp-site-report-agent';

const CHECK_ONLY = process.argv.includes('--check');

// The graph's fixed geometry. The first point and the "today" line are pinned;
// everything else derives from them, so the axis stays honest as weeks pass.
const X_FIRST = 70;
const X_TODAY = 440;
const Y_AXIS_LABEL = 400;
const MIN_LABEL_GAP = 34;
const ORIGIN = '2026-07-10';

// The six shipped features, in the order they appear in the file. The dates come
// from the bot repo's git history and its ADRs. They are facts, not estimates.
const SHIPPED = [
  { label: 'Site reports', date: '2026-07-10' },
  { label: 'Invoices', date: '2026-07-18' },
  { label: 'Planning', date: '2026-07-29' },
  { label: 'Customers', date: '2026-08-05' },
  { label: 'Live on', date: '2026-08-21' },
  { label: 'No evidence', date: '2026-08-24' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function fail(msg) {
  console.error('refresh-status-page: ' + msg);
  process.exit(1);
}

function days(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

// ---------------------------------------------------------------- the figures

function git() {
  const args = ['-C', BOT_REPO].concat(Array.prototype.slice.call(arguments));
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function readFigures() {
  try {
    git('fetch', 'origin', 'master', '--quiet');
  } catch (e) {
    // No network is not a reason to publish a half-updated page.
    fail('could not fetch the bot repo. Nothing was changed.');
  }

  const adrs = git('ls-tree', '--name-only', 'origin/master', 'docs/adr/')
    .split('\n').map(function (s) { return s.trim(); }).filter(Boolean).length;

  const flowTest = git('show', 'origin/master:scripts/flow-test.js');
  const m = flowTest.match(/all\s+(\d+)\s+scenarios passed/);
  if (!m) fail('could not find the scenario count in scripts/flow-test.js.');
  const scenarios = Number(m[1]);

  // Both counts only ever rise. A drop means the read is wrong, not that work was
  // deleted, and publishing a lower number would misrepresent the system.
  if (adrs < 27) fail('ADR count came back as ' + adrs + ', below the known floor of 27.');
  if (scenarios < 56) fail('scenario count came back as ' + scenarios + ', below the known floor of 56.');

  return { adrs: adrs, scenarios: scenarios };
}

// ------------------------------------------------------------------- the edits

function replaceOnce(src, re, make, what) {
  const all = src.match(new RegExp(re.source, re.flags.replace('g', '') + 'g'));
  if (!all) fail('could not find ' + what + ' in the page. Nothing was changed.');
  if (all.length !== 1) fail(what + ' appears ' + all.length + ' times; refusing to guess which to edit.');
  return src.replace(re, make);
}

function setNumbers(src, figures) {
  src = replaceOnce(src,
    /(<span data-count=")\d+(">0<\/span><\/div><div class="k">checks before each change)/,
    '$1' + figures.scenarios + '$2', 'the "checks before each change" counter');
  src = replaceOnce(src,
    /(<span data-count=")\d+(">0<\/span><\/div><div class="k">decisions written down)/,
    '$1' + figures.adrs + '$2', 'the "decisions written down" counter');
  // The footer repeats both figures in prose. If those ever disagree with the
  // counters the page contradicts itself, so they move together or not at all.
  src = replaceOnce(src, /\d+( checks pass before any change reaches your phone)/,
    figures.scenarios + '$1', 'the footer scenario count');
  src = replaceOnce(src, /\d+( decisions written down\.)/,
    figures.adrs + '$1', 'the footer decision count');
  return src;
}

function setDates(src, today) {
  const parts = today.split('-').map(Number);
  const short = parts[2] + ' ' + MONTHS[parts[1] - 1] + ' ' + parts[0];
  const long = parts[2] + ' ' + MONTHS_LONG[parts[1] - 1] + ' ' + parts[0];
  src = replaceOnce(src, /(<b>Build status<\/b> · )[^<]+/, '$1' + short, 'the top bar date');
  src = replaceOnce(src, /(<span>Build status · )[^<]+(<\/span>)/, '$1' + long + '$2', 'the footer date');
  return src;
}

function xFor(date, today) {
  const span = days(ORIGIN, today);
  if (span <= 0) fail('today is not after the first shipped feature.');
  return Math.round(X_FIRST + (days(ORIGIN, date) * (X_TODAY - X_FIRST)) / span);
}

function rescalePoints(src, today) {
  // Only the shipped half moves. The dashed "coming" points are ordered, not
  // dated, so their positions make no claim that could go stale.
  // Slice between start positions rather than matching a closing tag. Each point
  // nests an inner </g>, and a comment sits between the shipped and coming
  // groups, so any lookahead-based match silently swallows a neighbour.
  const starts = [];
  const startRe = /<g class="pt[^"]*"/g;
  let m;
  while ((m = startRe.exec(src)) !== null) starts.push({ at: m.index, soon: m[0].indexOf('soon') !== -1 });
  const svgEnd = src.indexOf('</svg>', starts.length ? starts[0].at : 0);
  if (svgEnd < 0) fail('could not find the end of the timeline graph.');

  const shipped = [];
  for (let i = 0; i < starts.length; i++) {
    if (starts[i].soon) continue;
    const from = starts[i].at;
    const to = i + 1 < starts.length ? starts[i + 1].at : svgEnd;
    shipped.push({ from: from, to: to, text: src.slice(from, to) });
  }
  if (shipped.length !== SHIPPED.length) {
    fail('expected ' + SHIPPED.length + ' shipped points, found ' + shipped.length + '. Nothing was changed.');
  }

  // Rebuild back-to-front so earlier offsets stay valid as slices are swapped.
  const moves = [];
  for (let i = shipped.length - 1; i >= 0; i--) {
    const block = shipped[i].text;
    const spec = SHIPPED[i];
    // Position in the file is how each point is identified, so confirm the label
    // still matches before moving it. A reordered file must stop the run.
    if (block.indexOf(spec.label) === -1) {
      fail('point ' + (i + 1) + ' does not contain "' + spec.label + '". The file order changed; refusing to move it.');
    }
    const cur = block.match(/<circle class="orb" cx="(-?\d+)"/);
    if (!cur) fail('could not read the current x of "' + spec.label + '".');
    const oldX = Number(cur[1]);
    const x = xFor(spec.date, today);

    const out = block
      .replace(/(<line class="stem" x1=")-?\d+(" y1="\d+" x2=")-?\d+(")/, '$1' + x + '$2' + x + '$3')
      .replace(/(<circle class="orb" cx=")-?\d+(")/, '$1' + x + '$2')
      .replace(/(<g class="emi" transform="translate\()-?\d+(,)/, '$1' + (x - 10) + '$2')
      .replace(/(<text class="ptlab" x=")-?\d+(")/g, '$1' + x + '$2');

    if (out !== block) src = src.slice(0, shipped[i].from) + out + src.slice(shipped[i].to);
    if (oldX !== x) moves.unshift(spec.label + ': x ' + oldX + ' -> ' + x);
  }
  return { src: src, moves: moves };
}

function rescaleMonths(src, today) {
  const start = src.indexOf('<text class="akey" x="' + X_FIRST + '" y="' + Y_AXIS_LABEL + '"');
  const todayIdx = src.indexOf('>today</text>');
  if (start < 0 || todayIdx < 0 || todayIdx < start) {
    fail('could not locate the month labels on the x axis. Nothing was changed.');
  }
  const runEnd = src.lastIndexOf('<text class="akey"', todayIdx);

  const t = today.split('-').map(Number);
  const labels = [{ x: X_FIRST, text: MONTHS[6] }]; // July is pinned at the origin
  let y = 2026;
  let m = 8;
  while (y < t[0] || (y === t[0] && m <= t[1])) {
    const first = y + '-' + String(m).padStart(2, '0') + '-01';
    const x = xFor(first, today);
    const last = labels[labels.length - 1].x;
    // Drop a label rather than let two collide, or let one collide with "today".
    if (x - last >= MIN_LABEL_GAP && X_TODAY - x >= MIN_LABEL_GAP) {
      labels.push({ x: x, text: MONTHS[m - 1] });
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Join with the file's own newline. Writing LF into a CRLF file leaves a
  // difference git normalises away, so the script would never settle: every
  // weekly run would rewrite the same bytes and commit nothing.
  const nl = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const newRun = labels.map(function (l) {
    return '<text class="akey" x="' + l.x + '" y="' + Y_AXIS_LABEL + '" text-anchor="middle">' + l.text + '</text>';
  }).join(nl + '        ') + nl + '        ';

  return {
    src: src.slice(0, start) + newRun + src.slice(runEnd),
    months: labels.map(function (l) { return l.text + '@' + l.x; })
  };
}

function countWords(src) {
  const t = src
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return t.split(/\s+/).filter(function (w) { return /[A-Za-z0-9£]/.test(w); }).length;
}

// ------------------------------------------------------------------------ main

const today = new Date().toISOString().slice(0, 10);
if (!fs.existsSync(PAGE)) fail(PAGE + ' does not exist. Refusing to create it.');

const before = fs.readFileSync(PAGE, 'utf8');
const figures = readFigures();

let src = setNumbers(before, figures);
src = setDates(src, today);
const pts = rescalePoints(src, today);
src = pts.src;
const mons = rescaleMonths(src, today);
src = mons.src;

const words = countWords(src);
if (words > 500) fail('the page would be ' + words + ' visible words, over the 500 limit. Nothing was written.');

const changed = src !== before;
console.log('today          ' + today);
console.log('scenarios      ' + figures.scenarios);
console.log('decisions      ' + figures.adrs);
console.log('words          ' + words + ' of 500');
console.log('month labels   ' + mons.months.join('  '));
console.log(pts.moves.length
  ? 'moved          ' + pts.moves.join('\n               ')
  : 'moved          nothing');
console.log('result         ' + (changed ? (CHECK_ONLY ? 'would change the page' : 'page updated') : 'no change needed'));

if (changed && !CHECK_ONLY) fs.writeFileSync(PAGE, src);

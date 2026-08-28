// Prove the status-page guard fires.
//
// verify-status-page.mjs is the only thing standing between an unattended
// weekly agent and a broken client-facing page. A check that has never been
// watched to fail is not a control, so each guard gets a deliberately broken
// copy of the page and must reject it — and must reject it for the right
// reason, not by accident.
//
//   node tools/test-status-page-guard.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'reliable-roofing.html');
const GUARD = path.join(HERE, 'verify-status-page.mjs');

const good = fs.readFileSync(PAGE, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'status-guard-'));

function run(html) {
  const file = path.join(tmp, 'page.html');
  fs.writeFileSync(file, html);
  try {
    const out = execFileSync('node', [GUARD], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { PAGE_PATH: file }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const cases = [
  {
    name: 'a clean page passes',
    html: good,
    expectPass: true,
  },
  {
    name: 'reworded copy is rejected',
    // The wording was agreed with Caren. This is the change most likely to be
    // made casually and the most damaging: Sam reads it.
    html: good.replace('No photo, no pay', 'No picture, no money'),
    expect: /wording changed/,
  },
  {
    name: 'a dropped noindex is rejected',
    html: good.replace(/<meta name="robots"[^>]*>/, ''),
    expect: /noindex meta tag is gone/,
  },
  {
    name: 'figures that disagree with the footer are rejected',
    html: good.replace(/(\d+)( checks pass before any change reaches your phone)/, '999$2'),
    expect: /scenario count disagrees with itself/,
  },
  {
    name: 'an emblem left behind by a moved orb is rejected',
    html: good.replace(/<circle class="orb" cx="70"/, '<circle class="orb" cx="123"'),
    expect: /off its circle|labels are not under its orb/,
  },
  {
    name: 'a deleted timeline point is rejected',
    html: (function () {
      const i = good.indexOf('<g class="pt"');
      const j = good.indexOf('<g class="pt"', i + 1);
      return good.slice(0, i) + good.slice(j);
    })(),
    expect: /shipped points, expected 6/,
  },
  {
    name: 'a page over the word budget is rejected',
    html: good.replace('</footer>',
      '<p>' + new Array(120).fill('padding').join(' ') + '</p></footer>'),
    expect: /over the agreed limit/,
  },
  {
    name: 'a missing graph is rejected',
    html: good.replace(/<svg class="tl"[\s\S]*?<\/svg>/, ''),
    expect: /shipped points, expected 6|missing entirely/,
  },
];

let failures = 0;
for (const c of cases) {
  const r = run(c.html);
  if (c.expectPass) {
    if (r.ok) {
      console.log('  pass  ' + c.name);
    } else {
      failures++;
      console.log('  FAIL  ' + c.name + ' — the guard rejected a good page');
      console.log('        ' + r.out.trim().split('\n').join('\n        '));
    }
    continue;
  }
  if (r.ok) {
    failures++;
    console.log('  FAIL  ' + c.name + ' — the guard let it through');
  } else if (!c.expect.test(r.out)) {
    failures++;
    console.log('  FAIL  ' + c.name + ' — rejected, but not for the expected reason');
    console.log('        ' + r.out.trim().split('\n').join('\n        '));
  } else {
    console.log('  pass  ' + c.name);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

if (failures) {
  console.error('\ntest-status-page-guard: ' + failures + ' of ' + cases.length + ' failed.');
  process.exit(1);
}
console.log('\ntest-status-page-guard: all ' + cases.length + ' guards fire.');

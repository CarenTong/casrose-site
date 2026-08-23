import { useEffect, useRef, useState } from "react";
import { EMBLEM_CIRCLE, EMBLEM_MOTIF_PATH, EMBLEM_VIEWBOX } from "./emblem.ts";
import "./HeroMotion.css";

/* ---------------------------------------------------------------------------
   Tunables — every value is lifted straight from the style pack (§§3-6) so the
   build is a faithful instance of the approved prototype, not a re-guess.
   ------------------------------------------------------------------------- */
// Style pack §3.2 specifies 16deg. Raised on Cas's direction (2026-08-11) — 16deg
// read as too subtle on the live full-viewport hero.
const TILT_MAX_DEG = 28;
const TILT_LERP = 0.09;
const ORB_LERP = 0.12;

const SPARK_CHANCE = 0.055; // per frame ≈ ~3/sec at 60fps
const SPARK_LIFE = 16; // frames a spark stays visible before it's gone

// Where the glyph drifts around on a touch device when nobody is dragging, as
// a fraction of the hero box: below the CTA and clear of the hint line.
const TOUCH_REST_X = 0.5;
const TOUCH_REST_Y = 0.72;

// Idle drift. Two out-of-phase waves per axis so the path wanders — circular,
// then wavy, then back — rather than tracing an obvious repeating loop.
const DRIFT = {
  xFast: 0.027,
  xSlow: 0.011,
  yFast: 0.019,
  ySlow: 0.009,
  xAmpFast: 18,
  xAmpSlow: 52,
  yAmpFast: 12,
  yAmpSlow: 34,
  ease: 0.06, // how quickly it glides back into the drift after a drag
};

/** Offset from the drift centre at a given step. */
function driftOffset(t: number) {
  return {
    x:
      Math.sin(t * DRIFT.xSlow) * DRIFT.xAmpSlow +
      Math.sin(t * DRIFT.xFast) * DRIFT.xAmpFast,
    y:
      Math.cos(t * DRIFT.ySlow) * DRIFT.yAmpSlow +
      Math.sin(t * DRIFT.yFast) * DRIFT.yAmpFast,
  };
}

/** Keep the drift centre far enough inside the box that the orbit stays visible. */
const DRIFT_MARGIN_X = DRIFT.xAmpSlow + DRIFT.xAmpFast + 20;
const DRIFT_MARGIN_Y = DRIFT.yAmpSlow + DRIFT.yAmpFast + 20;

// The style pack specified a destination-out trail-fade. That technique can't
// actually reach zero at 8-bit alpha precision (5 * 0.91 rounds back to 5), so it
// left a permanent faint film on the canvas. We clear every frame instead and let
// each particle draw its own motion streak — same glitter-trail look, and nothing
// can outlive the object that drew it.

const RIPPLE_DECAY = 0.965;
const PARTICLE_GRAVITY = 0.045;
const PARTICLE_DRAG = 0.985;
const PARTICLE_CAP = 420;

const GOLD_1 = "255, 224, 158";
const GOLD_2 = "255, 209, 122";

type Particle = {
  x: number;
  y: number;
  px: number; // previous position — drawn as a short streak for the trail look
  py: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string; // "r, g, b"
};

type Spark = {
  segs: Array<[number, number, number, number, number, number]>; // x,y,mx,my,ex,ey
  colors: string[];
  life: number;
};

type Ripple = {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  speed: number;
  delay: number;
  hit: Set<Element>;
};

type Target = { el: HTMLElement; cx: number; cy: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Deterministic-enough colour mix: ~25% white, ~37.5% gold-1, ~37.5% gold-2. */
function pickGlitterColor(): string {
  const r = Math.random();
  if (r < 0.25) return "255, 255, 255";
  if (r < 0.625) return GOLD_1;
  return GOLD_2;
}

type HeroMotionProps = {
  /** Fill the viewport (live homepage) instead of the 480px demo card. */
  fullBleed?: boolean;
  /** Show the small "under construction" status pill in the top-right. */
  underConstruction?: boolean;
  /** Called by the CTA and the Contact link. Undefined leaves them decorative. */
  onContact?: () => void;
};

export default function HeroMotion({
  fullBleed = false,
  underConstruction = false,
  onContact,
}: HeroMotionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // The "under construction" pill belongs to the two links that go nowhere yet,
  // so it only shows while Work or Studio is hovered or focused. Touch has no
  // hover, so a tap reveals it briefly instead.
  const [statusShown, setStatusShown] = useState(false);
  const statusTimer = useRef<number | undefined>(undefined);

  function revealStatus() {
    window.clearTimeout(statusTimer.current);
    setStatusShown(true);
  }

  function hideStatus() {
    window.clearTimeout(statusTimer.current);
    setStatusShown(false);
  }

  /** Tap on a dead link: show the pill, then take it away again. */
  function flashStatus() {
    window.clearTimeout(statusTimer.current);
    setStatusShown(true);
    statusTimer.current = window.setTimeout(() => setStatusShown(false), 2600);
  }

  useEffect(() => () => window.clearTimeout(statusTimer.current), []);

  // Media-query driven modes. Kept in state so the effect re-initialises when
  // they change (e.g. the user toggles reduced-motion / device emulation).
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [coarse, setCoarse] = useState(
    () => window.matchMedia("(hover: none), (pointer: coarse)").matches
  );

  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mm.matches);
    mm.addEventListener("change", onChange);
    return () => mm.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mm = window.matchMedia("(hover: none), (pointer: coarse)");
    const onChange = () => setCoarse(mm.matches);
    mm.addEventListener("change", onChange);
    return () => mm.removeEventListener("change", onChange);
  }, []);

  // One-time load-in shine (independent of the rAF machinery).
  useEffect(() => {
    if (reduced) return; // reduced motion gets a static sheen via CSS instead
    const shell = shellRef.current;
    if (!shell) return;
    shell.classList.add("is-shining");
    const onEnd = () => shell.classList.remove("is-shining");
    shell.addEventListener("animationend", onEnd, { once: true });
    return () => shell.removeEventListener("animationend", onEnd);
  }, [reduced]);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- mutable per-run state (refs would be overkill for effect-local data) -
    const pointer = { x: 0, y: 0 };
    const prevPointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    const tiltTarget = { x: 0, y: 0 };
    const orb = { x: 0, y: 0 };
    let orbSeeded = false;
    // Idle-drift state for the touch glyph: where it orbits, where it is now,
    // and how far through the drift we are.
    let restX = 0;
    let restY = 0;
    let glyphX = 0;
    let glyphY = 0;
    let driftT = 0;
    let restSeeded = false;
    let dragging = false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const particles: Particle[] = [];
    const sparks: Spark[] = [];
    const ripples: Ripple[] = [];
    let targets: Target[] = [];

    // ---- target caching (nav, wordmark, tagline, CTA, emblem) --------------
    function cacheTargets() {
      const rect = section!.getBoundingClientRect();
      targets = Array.from(
        section!.querySelectorAll<HTMLElement>("[data-target]")
      ).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          cx: r.left - rect.left + r.width / 2,
          cy: r.top - rect.top + r.height / 2,
        };
      });
    }

    // ---- canvas sizing (devicePixelRatio-scaled) ---------------------------
    function resize() {
      const rect = section!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height); // no stale trail after a resize
      cacheTargets();
      // On touch the glyph is always on show, so give it a home to sit in.
      if (!restSeeded) {
        restX = width * TOUCH_REST_X;
        restY = height * TOUCH_REST_Y;
        restSeeded = true;
      } else {
        // a resize must not teleport a glyph the visitor has already moved
        restX = clamp(restX, DRIFT_MARGIN_X, Math.max(DRIFT_MARGIN_X, width - DRIFT_MARGIN_X));
        restY = clamp(restY, DRIFT_MARGIN_Y, Math.max(DRIFT_MARGIN_Y, height - DRIFT_MARGIN_Y));
      }
      if (coarse && !dragging) {
        if (!glyphX && !glyphY) {
          glyphX = restX;
          glyphY = restY;
        }
        pointer.x = glyphX;
        pointer.y = glyphY;
        placeCursor(glyphX, glyphY);
        showCursor();
      }
    }

    // ---- target pulse (scale + brightness + glow flash), once per crossing -
    function firePulse(el: HTMLElement) {
      el.animate(
        [
          { transform: "scale(1)", filter: "brightness(1)" },
          {
            transform: "scale(1.09)",
            filter: "brightness(1.4) drop-shadow(0 0 14px rgba(232,181,110,0.7))",
            offset: 0.35,
          },
          { transform: "scale(1)", filter: "brightness(1)" },
        ],
        { duration: 480, easing: "ease-out" }
      );
    }

    // ---- particle helpers --------------------------------------------------
    function spawnParticle(x: number, y: number, vx: number, vy: number) {
      if (particles.length >= PARTICLE_CAP) particles.shift(); // drop oldest
      const maxLife = 55 + Math.random() * 45; // 55-100 frames
      particles.push({
        x,
        y,
        px: x,
        py: y,
        vx,
        vy,
        life: maxLife,
        maxLife,
        size: 0.8 + Math.random() * 1.5, // 0.8-2.3px
        color: pickGlitterColor(),
      });
    }

    function burst(x: number, y: number, count: number) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 2.4;
        spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 0.6);
      }
    }

    function spawnRipples(x: number, y: number) {
      const diag = Math.hypot(width, height);
      ripples.push({
        x,
        y,
        r: 0,
        maxR: diag * 0.95,
        alpha: 0.5,
        speed: 6.2,
        delay: 0,
        hit: new Set(),
      });
      ripples.push({
        x,
        y,
        r: 0,
        maxR: diag * 0.72,
        alpha: 0.36,
        speed: 4.3,
        delay: 8,
        hit: new Set(),
      });
    }

    // ---- electric spark burst at the cursor (drawn straight to canvas) -----
    function spawnSpark(x: number, y: number) {
      const count = 3 + Math.floor(Math.random() * 3); // 3-5
      const segs: Spark["segs"] = [];
      const colors: string[] = [];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const len = 15 + Math.random() * 21; // 15-36px, roughly double the original
        const midR = len * (0.4 + Math.random() * 0.3);
        const jitter = (Math.random() - 0.5) * 8;
        const midA = a + (Math.random() - 0.5) * 0.9;
        const mx = x + Math.cos(midA) * midR + Math.cos(a + Math.PI / 2) * jitter;
        const my = y + Math.sin(midA) * midR + Math.sin(a + Math.PI / 2) * jitter;
        segs.push([x, y, mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len]);
        colors.push(i % 2 === 0 ? "255,255,255" : "255,209,122");
      }
      sparks.push({ segs, colors, life: SPARK_LIFE });
    }

    function drawSparks() {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life--;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const alpha = (s.life / SPARK_LIFE) * 0.92;
        ctx!.lineWidth = 1.4; // heavier so the longer bolts still read
        s.segs.forEach(([x, y, mx, my, ex, ey], j) => {
          ctx!.beginPath();
          ctx!.moveTo(x, y);
          ctx!.lineTo(mx, my);
          ctx!.lineTo(ex, ey);
          ctx!.strokeStyle = `rgba(${s.colors[j]},${alpha})`;
          ctx!.stroke();
        });
      }
    }

    // ---- draws shared by both the live loop and the static fallback --------
    function drawParticle(p: Particle) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      // streak from the previous position gives the glitter its trail without
      // relying on anything staying painted on the canvas between frames
      ctx!.beginPath();
      ctx!.strokeStyle = `rgba(${p.color}, ${alpha * 0.85})`;
      ctx!.lineWidth = p.size;
      ctx!.lineCap = "round";
      ctx!.moveTo(p.px, p.py);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.fillStyle = `rgba(${p.color}, ${alpha})`;
      ctx!.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx!.fill();
    }

    // =======================================================================
    //  LIVE LOOPS (skipped entirely under prefers-reduced-motion)
    // =======================================================================
    let ambientRaf = 0;
    let drawRaf = 0;

    function ambientTick() {
      // tilt eases toward its target (0/0 target on leave → eases back flat)
      tilt.x = lerp(tilt.x, tiltTarget.x, TILT_LERP);
      tilt.y = lerp(tilt.y, tiltTarget.y, TILT_LERP);
      if (emblemRef.current) {
        emblemRef.current.style.transform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
      }
      // ambient orb lags the pointer (atmosphere, not a pointer)
      if (orbSeeded) {
        orb.x = lerp(orb.x, pointer.x, ORB_LERP);
        orb.y = lerp(orb.y, pointer.y, ORB_LERP);
        if (orbRef.current) {
          orbRef.current.style.transform = `translate(${orb.x}px, ${orb.y}px)`;
        }
      }
      // Touch glyph drifts while idle, to invite a finger. It eases toward the
      // drift path rather than snapping, so releasing a drag glides back in.
      if (coarse && !dragging) {
        driftT++;
        const off = driftOffset(driftT);
        const targetX = restX + off.x;
        const targetY = restY + off.y;
        glyphX = lerp(glyphX, targetX, DRIFT.ease);
        glyphY = lerp(glyphY, targetY, DRIFT.ease);
        placeCursor(glyphX, glyphY);
        // sparks originate from wherever the glyph currently is
        pointer.x = glyphX;
        pointer.y = glyphY;
      }
      ambientRaf = requestAnimationFrame(ambientTick);
    }

    function drawTick() {
      // Wipe and repaint from live objects only — guarantees nothing lingers.
      ctx!.clearRect(0, 0, width, height);

      // intermittent cursor sparks (only while the glyph is live)
      if (cursorVisible && Math.random() < SPARK_CHANCE) {
        spawnSpark(pointer.x, pointer.y);
      }
      drawSparks();

      // ripples: grow, fade, pulse any target the leading edge crosses
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        if (rp.delay > 0) {
          rp.delay--;
        } else {
          rp.r += rp.speed;
          rp.alpha *= RIPPLE_DECAY;
        }
        if (rp.r >= rp.maxR || rp.alpha < 0.02) {
          ripples.splice(i, 1);
          continue;
        }
        if (rp.delay <= 0) {
          for (const t of targets) {
            if (rp.hit.has(t.el)) continue;
            const d = Math.hypot(t.cx - rp.x, t.cy - rp.y);
            if (rp.r >= d) {
              rp.hit.add(t.el);
              firePulse(t.el);
            }
          }
          ctx!.beginPath();
          ctx!.strokeStyle = `rgba(232, 181, 110, ${rp.alpha})`;
          ctx!.lineWidth = 1.4;
          ctx!.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // particles: integrate physics, fade, cull
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.px = p.x;
        p.py = p.y;
        p.vy += PARTICLE_GRAVITY;
        p.vx *= PARTICLE_DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        drawParticle(p);
      }

      drawRaf = requestAnimationFrame(drawTick);
    }

    // =======================================================================
    //  REDUCED-MOTION STATIC REACTION (no loop — drawn once per click)
    // =======================================================================
    function staticReaction(x: number, y: number) {
      ctx!.clearRect(0, 0, width, height);
      // single static ring
      ctx!.beginPath();
      ctx!.strokeStyle = "rgba(232, 181, 110, 0.55)";
      ctx!.lineWidth = 1.4;
      ctx!.arc(x, y, 46, 0, Math.PI * 2);
      ctx!.stroke();
      // ~20 static dots
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const rr = 14 + Math.random() * 30;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${pickGlitterColor()}, 0.85)`;
        ctx!.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.4, 0, Math.PI * 2);
        ctx!.fill();
      }
      // direct pulse on any target within 150px
      for (const t of targets) {
        if (Math.hypot(t.cx - x, t.cy - y) <= 150) firePulse(t.el);
      }
    }

    // ---- pointer plumbing --------------------------------------------------
    let cursorVisible = false;

    function localPoint(e: PointerEvent) {
      const rect = section!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function showCursor() {
      cursorVisible = true;
      if (cursorRef.current) cursorRef.current.style.opacity = "1";
      // the ambient orb stays a hover-only flourish; touch gets the glyph alone
      if (!coarse && orbRef.current) orbRef.current.style.opacity = "1";
    }

    /** Position the glyph, lifted clear of the fingertip on touch. */
    function placeCursor(x: number, y: number) {
      if (!cursorRef.current) return;
      const size = coarse ? 17 : 13; // half the glyph width
      // centred on the pointer, so the mark and its glitter share a position
      cursorRef.current.style.transform = `translate(${x - size}px, ${y - size}px)`;
    }

    function onPointerMove(e: PointerEvent) {
      const p = localPoint(e);
      prevPointer.x = pointer.x;
      prevPointer.y = pointer.y;
      pointer.x = p.x;
      pointer.y = p.y;

      // On touch the glyph only exists while a finger is down; with a mouse it
      // follows the pointer the whole time it is over the hero.
      if (coarse) {
        if (dragging) {
          glyphX = p.x;
          glyphY = p.y;
          placeCursor(p.x, p.y);
          if (!cursorVisible) showCursor();
        }
      } else {
        // cursor glyph tracks 1:1 — no lerp, immediate (§5.3)
        placeCursor(p.x, p.y);
        if (!cursorVisible) showCursor();
        if (!orbSeeded) {
          orb.x = p.x;
          orb.y = p.y;
          orbSeeded = true;
        }
        // tilt target from normalised pointer position
        if (!reduced) {
          const nx = clamp((p.x - width / 2) / (width / 2), -1, 1);
          const ny = clamp((p.y - height / 2) / (height / 2), -1, 1);
          tiltTarget.y = nx * TILT_MAX_DEG;
          tiltTarget.x = -ny * TILT_MAX_DEG;
        }
      }

      // drag trail: 3 particles/event, inheriting 28% of drag velocity
      if (dragging && !reduced) {
        const vx = (pointer.x - prevPointer.x) * 0.28;
        const vy = (pointer.y - prevPointer.y) * 0.28;
        for (let i = 0; i < 3; i++) {
          spawnParticle(
            pointer.x,
            pointer.y,
            vx + (Math.random() - 0.5) * 1.2,
            vy + (Math.random() - 0.5) * 1.2
          );
        }
      }
    }

    function onPointerDown(e: PointerEvent) {
      const p = localPoint(e);
      pointer.x = p.x;
      pointer.y = p.y;
      if (reduced) {
        staticReaction(p.x, p.y); // one static reaction, no loop
        return;
      }
      dragging = true;
      if (coarse) {
        glyphX = p.x;
        glyphY = p.y;
        placeCursor(p.x, p.y);
        showCursor();
      }
      spawnRipples(p.x, p.y);
      burst(p.x, p.y, 10);
    }

    function endDrag() {
      dragging = false;
      if (!coarse) return;
      // The glyph stays where the finger left it and hovers around *there*,
      // rather than sailing back to one fixed spot. Cancelling out the current
      // wave offset means the drift resumes from exactly this point with no jump.
      const off = driftOffset(driftT);
      restX = clamp(
        glyphX - off.x,
        DRIFT_MARGIN_X,
        Math.max(DRIFT_MARGIN_X, width - DRIFT_MARGIN_X)
      );
      restY = clamp(
        glyphY - off.y,
        DRIFT_MARGIN_Y,
        Math.max(DRIFT_MARGIN_Y, height - DRIFT_MARGIN_Y)
      );
    }

    function onPointerLeave() {
      dragging = false;
      if (coarse) return; // the resting glyph stays put on touch devices
      cursorVisible = false;
      tiltTarget.x = 0;
      tiltTarget.y = 0;
      if (cursorRef.current) cursorRef.current.style.opacity = "0";
      if (orbRef.current) orbRef.current.style.opacity = "0";
    }

    // ---- wiring ------------------------------------------------------------
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(section);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", cacheTargets, { passive: true });

    section.addEventListener("pointermove", onPointerMove);
    section.addEventListener("pointerdown", onPointerDown);
    section.addEventListener("pointerup", endDrag);
    section.addEventListener("pointercancel", endDrag);
    section.addEventListener("pointerleave", onPointerLeave);

    if (!reduced) {
      ambientRaf = requestAnimationFrame(ambientTick);
      drawRaf = requestAnimationFrame(drawTick);
    }

    return () => {
      cancelAnimationFrame(ambientRaf);
      cancelAnimationFrame(drawRaf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", cacheTargets);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointerup", endDrag);
      section.removeEventListener("pointercancel", endDrag);
      section.removeEventListener("pointerleave", onPointerLeave);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [reduced, coarse]);

  const heroClass = [
    "casrose-hero",
    fullBleed ? "is-fullbleed" : "",
    reduced ? "is-reduced" : "",
    coarse ? "is-coarse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section ref={sectionRef} className={heroClass} aria-label="Casrose">
      <canvas ref={canvasRef} className="casrose-canvas" aria-hidden="true" />
      <div ref={orbRef} className="casrose-orb" aria-hidden="true" />

      <div className="casrose-content">
        <nav className="casrose-nav">
          <button type="button" className="casrose-brand" data-target>
            CASROSE
          </button>
          {/* Absolutely positioned so appearing and disappearing never reflows the
              nav. Kept in the DOM while hidden so the aria-describedby on the two
              dead links still reads it out. */}
          {underConstruction && (
            <span
              id="casrose-status"
              className={`casrose-status${statusShown ? " is-shown" : ""}`}
            >
              <span className="casrose-status-dot" aria-hidden="true" />
              Under construction
            </span>
          )}
          <div className="casrose-navlinks">
            {["Work", "Studio"].map((label) => (
              <button
                key={label}
                type="button"
                className="casrose-navlink"
                data-target
                // describedby means a screen reader announces "Work, under
                // construction" without depending on a hover that never happens
                aria-describedby={underConstruction ? "casrose-status" : undefined}
                onMouseEnter={underConstruction ? revealStatus : undefined}
                onMouseLeave={underConstruction ? hideStatus : undefined}
                onFocus={underConstruction ? revealStatus : undefined}
                onBlur={underConstruction ? hideStatus : undefined}
                onClick={underConstruction ? flashStatus : undefined}
              >
                {label}
              </button>
            ))}
            <button type="button" className="casrose-navlink" data-target onClick={onContact}>
              Contact
            </button>
          </div>
        </nav>

        <div className="casrose-centre">
          <div ref={shellRef} className="casrose-emblem-shell" data-target>
            <div ref={emblemRef} className="casrose-emblem">
              <svg viewBox={EMBLEM_VIEWBOX} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <linearGradient id="casrose-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F4D9A8" />
                    <stop offset="55%" stopColor="#D4964F" />
                    <stop offset="100%" stopColor="#9B4F29" />
                  </linearGradient>
                </defs>
                <circle
                  cx={EMBLEM_CIRCLE.cx}
                  cy={EMBLEM_CIRCLE.cy}
                  r={EMBLEM_CIRCLE.r}
                  fill="none"
                  stroke="url(#casrose-grad)"
                  strokeWidth={3.5}
                  opacity={0.9}
                />
                <path d={EMBLEM_MOTIF_PATH} fill="url(#casrose-grad)" opacity={0.95} />
              </svg>
            </div>
            <div className="casrose-emblem-shine" aria-hidden="true" />
          </div>

          <h1 className="casrose-wordmark" data-target>
            CASROSE
          </h1>
          <p className="casrose-tagline" data-target>
            Rise Together
          </p>
          <button type="button" className="casrose-cta" data-target onClick={onContact}>
            Start a project
          </button>
        </div>

        <p className="casrose-hint">Move, click and drag — the rose is listening.</p>
      </div>

      <div ref={cursorRef} className="casrose-cursor" aria-hidden="true">
        <svg viewBox={EMBLEM_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="casrose-cursor-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F4D9A8" />
              <stop offset="55%" stopColor="#D4964F" />
              <stop offset="100%" stopColor="#9B4F29" />
            </linearGradient>
          </defs>
          <circle
            cx={EMBLEM_CIRCLE.cx}
            cy={EMBLEM_CIRCLE.cy}
            r={EMBLEM_CIRCLE.r}
            fill="none"
            stroke="url(#casrose-cursor-grad)"
            strokeWidth={14}
            opacity={0.95}
          />
          <path d={EMBLEM_MOTIF_PATH} fill="url(#casrose-cursor-grad)" opacity={0.95} />
        </svg>
      </div>
    </section>
  );
}

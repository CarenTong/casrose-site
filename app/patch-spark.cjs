const fs=require("fs");
const f="src/HeroMotion.tsx";
let s=fs.readFileSync(f,"utf8");
const need=(n,l)=>{if(!s.includes(n)){console.error("MISSING: "+l);process.exit(1);}};

// --- sparks: more often, and longer bolts ---------------------------------
need("const SPARK_CHANCE = 0.016;","spark chance");
s=s.replace("const SPARK_CHANCE = 0.016; // per frame ≈ ~1/sec at 60fps",
            "const SPARK_CHANCE = 0.055; // per frame ≈ ~3/sec at 60fps");

need("        const len = 7 + Math.random() * 11; // 7-18px","spark length");
s=s.replace("        const len = 7 + Math.random() * 11; // 7-18px",
            "        const len = 15 + Math.random() * 21; // 15-36px, roughly double the original");

need('        ctx!.lineWidth = 1.1;\n        s.segs.forEach','spark line width');
s=s.replace('        ctx!.lineWidth = 1.1;\n        s.segs.forEach',
            '        ctx!.lineWidth = 1.4; // slightly heavier so the longer bolts read\n        s.segs.forEach');

// --- resting glyph on touch: visible even when nobody is dragging ----------
need(`const TOUCH_CURSOR_LIFT = 46;`,"lift const");
s=s.replace(`const TOUCH_CURSOR_LIFT = 46;`,
`const TOUCH_CURSOR_LIFT = 46;

// Where the glyph waits on a touch device when no one is dragging, as a
// fraction of the hero box. Sits below the CTA and clear of the hint line.
const TOUCH_REST_X = 0.5;
const TOUCH_REST_Y = 0.74;`);

// place it at rest whenever the canvas is (re)sized
need(`      ctx!.clearRect(0, 0, width, height); // no stale trail after a resize
      cacheTargets();`,"resize body");
s=s.replace(`      ctx!.clearRect(0, 0, width, height); // no stale trail after a resize
      cacheTargets();`,
`      ctx!.clearRect(0, 0, width, height); // no stale trail after a resize
      cacheTargets();
      // On touch the glyph is always on show, so give it a home to sit in.
      if (coarse && !dragging) {
        pointer.x = width * TOUCH_REST_X;
        pointer.y = height * TOUCH_REST_Y;
        placeCursor(pointer.x, pointer.y);
        showCursor();
      }`);

// lifting a finger should leave the glyph on the page, not hide it
need(`    function endDrag() {
      dragging = false;
      if (coarse) {
        // no hover on touch: the glyph fades out with the finger
        cursorVisible = false;
        if (cursorRef.current) cursorRef.current.style.opacity = "0";
      }
    }`,"endDrag");
s=s.replace(`    function endDrag() {
      dragging = false;
      if (coarse) {
        // no hover on touch: the glyph fades out with the finger
        cursorVisible = false;
        if (cursorRef.current) cursorRef.current.style.opacity = "0";
      }
    }`,
`    function endDrag() {
      dragging = false;
      // On touch the glyph stays put where the finger left it, still sparking,
      // rather than disappearing the moment contact ends.
    }`);

// pointerleave must not hide it on touch either
need(`    function onPointerLeave() {
      cursorVisible = false;
      dragging = false;`,"pointerleave");
s=s.replace(`    function onPointerLeave() {
      cursorVisible = false;
      dragging = false;`,
`    function onPointerLeave() {
      dragging = false;
      if (coarse) return; // the resting glyph stays visible on touch devices
      cursorVisible = false;`);

fs.writeFileSync(f,s);
console.log("sparks + resting glyph patched");

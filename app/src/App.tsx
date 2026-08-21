import { useCallback, useEffect, useState } from "react";
import ContactSection from "./ContactSection.tsx";
import HeroMotion from "./HeroMotion.tsx";

/**
 * Phones get the hero as a fixed, non-scrolling screen with the contact form in
 * a panel; anything wider keeps the scrolling page. The split exists because on
 * touch, dragging a finger is both "draw the glitter trail" and "scroll the
 * page", and the browser wins that fight — so the page must not scroll.
 */
const PANEL_QUERY = "(max-width: 600px), (pointer: coarse)";

export default function App() {
  const [asPanel, setAsPanel] = useState(() => window.matchMedia(PANEL_QUERY).matches);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mm = window.matchMedia(PANEL_QUERY);
    const onChange = () => setAsPanel(mm.matches);
    mm.addEventListener("change", onChange);
    return () => mm.removeEventListener("change", onChange);
  }, []);

  // Locking the body while the panel is open stops the hero scrolling behind it.
  useEffect(() => {
    document.body.classList.toggle("cr-locked", asPanel && open);
    return () => document.body.classList.remove("cr-locked");
  }, [asPanel, open]);

  const openContact = useCallback(() => {
    if (asPanel) {
      setOpen(true);
      // let the panel finish transitioning in before taking focus
      window.setTimeout(() => document.getElementById("cr-name")?.focus(), 340);
      return;
    }
    const target = document.getElementById("contact");
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.setTimeout(
      () => document.getElementById("cr-name")?.focus({ preventScroll: true }),
      reduced ? 0 : 500
    );
  }, [asPanel]);

  const closeContact = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* under-construction stays until the Work / Studio pages exist */}
      <HeroMotion fullBleed underConstruction onContact={openContact} />
      <ContactSection asPanel={asPanel} open={open} onClose={closeContact} />
    </>
  );
}

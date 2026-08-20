import HeroMotion from "./HeroMotion.tsx";

export default function App() {
  // Live homepage: fill the viewport and show the under-construction pill
  // (the decorative nav/CTA buttons aren't wired up yet).
  return <HeroMotion fullBleed underConstruction />;
}

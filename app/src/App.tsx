import ContactSection from "./ContactSection.tsx";
import HeroMotion from "./HeroMotion.tsx";

export default function App() {
  // The CTA and the Contact link scroll to the one contact form rather than
  // opening a second copy of it in a modal — one form, two ways in.
  function goToContact() {
    const target = document.getElementById("contact");
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // Move keyboard focus too, so the scroll isn't sighted-users-only.
    const firstField = document.getElementById("cr-name");
    window.setTimeout(() => firstField?.focus({ preventScroll: true }), reduced ? 0 : 500);
  }

  return (
    <>
      {/* under-construction stays until the Work / Studio pages exist */}
      <HeroMotion fullBleed underConstruction onContact={goToContact} />
      <ContactSection />
      <footer className="cr-footer">
        <p>Casrose — bespoke AI automation.</p>
        <p className="cr-legal">
          Registered with the Information Commissioner&apos;s Office, registration
          number ZB941135.
        </p>
        <p className="cr-legal">71–75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
      </footer>
    </>
  );
}

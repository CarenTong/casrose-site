import { useEffect, useRef, useState } from "react";
import "./ContactSection.css";

/** Where the form posts. A small PHP script alongside index.html on Hostinger. */
const ENDPOINT = "contact.php";

type Status = "idle" | "sending" | "sent" | "error";

type Props = {
  /**
   * Phones show this as a full-screen panel opened from the CTA. The hero owns
   * the whole viewport there, because finger-drag has to mean "draw", not
   * "scroll" — the two gestures are the same on touch. Desktop keeps it as an
   * ordinary section below the hero.
   */
  asPanel?: boolean;
  open?: boolean;
  onClose?: () => void;
};

export default function ContactSection({ asPanel = false, open = false, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // A submission faster than a human could type is a bot.
  const loadedAt = useRef(Date.now());

  // Escape closes the panel, as any modal should.
  useEffect(() => {
    if (!asPanel || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asPanel, open, onClose]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    setStatus("sending");
    setMessage("");

    const data = new FormData(form);
    data.set("elapsed", String(Date.now() - loadedAt.current));
    // tells the endpoint to answer JSON rather than a full HTML page
    data.set("js", "1");

    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: data });
      // The endpoint always answers JSON; anything else means PHP itself failed.
      const body = await res.json().catch(() => null);

      if (res.ok && body?.ok) {
        setStatus("sent");
        setMessage("Thank you — your message is on its way. I'll reply by email.");
        form.reset();
        loadedAt.current = Date.now();
      } else {
        setStatus("error");
        setMessage(
          body?.error ??
            "Something went wrong sending that. Please email cas@casrose.co.uk directly."
        );
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please email cas@casrose.co.uk directly.");
    }
  }

  const className = [
    "cr-contact",
    asPanel ? "is-panel" : "",
    asPanel && open ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={className}
      id="contact"
      aria-labelledby="cr-contact-title"
      // When it's a panel it behaves as a dialog; hidden from assistive tech
      // entirely while closed so it isn't reachable behind the hero.
      role={asPanel ? "dialog" : undefined}
      aria-modal={asPanel ? true : undefined}
      // visibility:hidden on the closed panel already takes its controls out of
      // the tab order, so no inert attribute is needed here.
      aria-hidden={asPanel && !open ? true : undefined}
    >
      <div className="cr-contact-inner">
        {asPanel && (
          <button
            ref={closeRef}
            type="button"
            className="cr-close"
            onClick={onClose}
            aria-label="Close contact form"
          >
            &times;
          </button>
        )}

        <h2 className="cr-contact-title" id="cr-contact-title">
          Start a project
        </h2>
        <p className="cr-contact-lede">
          Tell me what you're trying to automate and I'll come back to you by email.
        </p>

        <form
          ref={formRef}
          className="cr-form"
          // Works without JavaScript too: posts straight to the PHP endpoint.
          action={ENDPOINT}
          method="post"
          onSubmit={onSubmit}
        >
          <div className="cr-field">
            <label htmlFor="cr-name">Your name</label>
            <input id="cr-name" name="name" type="text" required maxLength={100} autoComplete="name" />
          </div>

          <div className="cr-field">
            <label htmlFor="cr-email">Email</label>
            <input id="cr-email" name="email" type="email" required maxLength={200} autoComplete="email" />
          </div>

          <div className="cr-field">
            <label htmlFor="cr-message">What can I help with?</label>
            <textarea id="cr-message" name="message" required maxLength={4000} rows={5} />
          </div>

          {/* Honeypot: hidden from people, irresistible to bots. Any value here
              means we can drop the submission silently. */}
          <div className="cr-hp" aria-hidden="true">
            <label htmlFor="cr-company">Company (leave this blank)</label>
            <input id="cr-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <button type="submit" className="cr-submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send message"}
          </button>

          <p className="cr-privacy">
            Your details are emailed to me so I can reply, and are not used for anything
            else, shared, or added to a mailing list.
          </p>

          <p className={`cr-status is-${status}`} role="status" aria-live="polite">
            {message}
          </p>
        </form>

        <div className="cr-direct">
          <p>Or reach me directly:</p>
          <ul>
            <li>
              <a href="mailto:cas@casrose.co.uk">cas@casrose.co.uk</a>
            </li>
            <li>
              <a href="tel:+44349956460">+44 34995 6460</a>
            </li>
          </ul>
        </div>

        {/* Lives inside the section so the ICO registration is reachable in both
            layouts — on a phone the page itself no longer scrolls. */}
        <div className="cr-footer">
          <p>Casrose — bespoke AI automation.</p>
          <p className="cr-legal">
            Registered with the Information Commissioner&apos;s Office, registration
            number ZB941135.
          </p>
          <p className="cr-legal">71–75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
          <p className="cr-legal cr-legal-links">
            <a href="/privacy.html">Privacy</a>
            <span aria-hidden="true"> · </span>
            <a href="/terms.html">Terms</a>
            <span aria-hidden="true"> · </span>
            <a href="/data-deletion.html">Data deletion</a>
          </p>
        </div>
      </div>
    </section>
  );
}

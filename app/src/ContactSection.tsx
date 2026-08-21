import { useRef, useState } from "react";
import "./ContactSection.css";

/** Where the form posts. A small PHP script alongside index.html on Hostinger. */
const ENDPOINT = "contact.php";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // Timestamp of first render — a submission faster than a human could type is a bot.
  const loadedAt = useRef(Date.now());

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
      // The endpoint always answers JSON; a non-JSON body means PHP itself failed.
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
      setMessage(
        "Couldn't reach the server. Please email cas@casrose.co.uk directly."
      );
    }
  }

  return (
    <section className="cr-contact" id="contact" aria-labelledby="cr-contact-title">
      <div className="cr-contact-inner">
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
          noValidate={false}
        >
          <div className="cr-field">
            <label htmlFor="cr-name">Your name</label>
            <input
              id="cr-name"
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
            />
          </div>

          <div className="cr-field">
            <label htmlFor="cr-email">Email</label>
            <input
              id="cr-email"
              name="email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
            />
          </div>

          <div className="cr-field">
            <label htmlFor="cr-message">What can I help with?</label>
            <textarea id="cr-message" name="message" required maxLength={4000} rows={5} />
          </div>

          {/* Honeypot: hidden from people, irresistible to bots. Never filled by a
              real user, so any value means we can drop the submission silently. */}
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

          {/* Announced to screen readers as soon as it changes. */}
          <p
            className={`cr-status is-${status}`}
            role="status"
            aria-live="polite"
          >
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
      </div>
    </section>
  );
}

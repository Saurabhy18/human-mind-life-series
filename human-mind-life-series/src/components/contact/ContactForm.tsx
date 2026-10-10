"use client";

import { useState } from "react";
import { CONTACT_TOPICS } from "@/lib/constants";
import { trackContact } from "@/lib/analytics";
import { IconCheck } from "../icons";

type Errors = Record<string, string>;

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setStatus("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; errors?: Errors };
      if (res.ok && json.ok) {
        setStatus("sent");
        trackContact();
        return;
      }
      setErrors(json.errors ?? {});
      setFormError(json.message ?? "Something went wrong. Please try again.");
    } catch {
      setFormError("Network error. Please try again.");
    }
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl bg-success/5 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <IconCheck width={26} height={26} />
        </div>
        <h3 className="mt-4 text-2xl">Thank you — message received</h3>
        <p className="mt-2 text-muted">We will get back to you as soon as possible.</p>
      </div>
    );
  }

  const err = (n: string) => (errors[n] ? <p id={`${n}-error`} className="mt-1.5 text-sm text-danger">{errors[n]}</p> : null);
  const aria = (n: string) => ({ "aria-invalid": !!errors[n] || undefined, "aria-describedby": errors[n] ? `${n}-error` : undefined });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="hidden" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">Name *</label>
          <input id="c-name" name="name" className="input" autoComplete="name" maxLength={80} {...aria("name")} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="c-email" className="label">Email *</label>
          <input id="c-email" name="email" type="email" className="input" autoComplete="email" maxLength={120} {...aria("email")} />
          {err("email")}
        </div>
        <div>
          <label htmlFor="c-phone" className="label">WhatsApp / Phone (optional)</label>
          <input id="c-phone" name="phone" type="tel" className="input" autoComplete="tel" maxLength={20} {...aria("phone")} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="c-topic" className="label">Topic *</label>
          <select id="c-topic" name="topic" className="input" defaultValue={CONTACT_TOPICS[0]} {...aria("topic")}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {err("topic")}
        </div>
      </div>
      <div>
        <label htmlFor="c-message" className="label">Message *</label>
        <textarea id="c-message" name="message" rows={6} className="input resize-y" maxLength={3000} {...aria("message")} />
        {err("message")}
      </div>
      {formError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {formError}
        </div>
      )}
      <button type="submit" disabled={status === "sending"} className="btn-primary w-full py-4 sm:w-auto sm:px-10">
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
      <p className="text-xs text-muted">
        Please do not include payment passwords, UPI PIN or OTPs in your message. See our <a href="/privacy-policy" className="underline">Privacy Policy</a>.
      </p>
    </form>
  );
}

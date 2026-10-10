import "server-only";
import { ENV } from "@/config/env.server";
import { CONFIG } from "@/config/site.config";
import { logger, errorMessage } from "./logger";

export type Email = { to: string; subject: string; text: string; html: string };
export type SendResult = { sent: true } | { sent: false; reason: string };

/** Emails captured in tests (EMAIL_TRANSPORT=json). */
export const sentEmailsForTests: Email[] = [];

let transporterPromise: Promise<import("nodemailer").Transporter> | null = null;

function configured(): boolean {
  return ENV.email.transport === "json" || !!(ENV.email.smtpHost && ENV.email.from);
}

async function transporter() {
  if (!transporterPromise) {
    transporterPromise = import("nodemailer").then((nm) =>
      ENV.email.transport === "json"
        ? nm.createTransport({ jsonTransport: true })
        : nm.createTransport({
            host: ENV.email.smtpHost,
            port: ENV.email.smtpPort,
            secure: ENV.email.smtpSecure,
            auth: ENV.email.smtpUser ? { user: ENV.email.smtpUser, pass: ENV.email.smtpPass } : undefined,
          }),
    );
  }
  return transporterPromise;
}

/** Sends an email if SMTP is configured; otherwise returns { sent: false } so the admin can deliver manually. */
export async function sendEmail(email: Email): Promise<SendResult> {
  if (!configured()) return { sent: false, reason: "Email is not configured (set SMTP_HOST and EMAIL_FROM)." };
  try {
    const t = await transporter();
    await t.sendMail({ from: ENV.email.from || `${CONFIG.SITE_NAME} <no-reply@localhost>`, ...email });
    if (ENV.email.transport === "json") sentEmailsForTests.push(email);
    return { sent: true };
  } catch (err) {
    logger.error("Email send failed", { error: errorMessage(err) });
    return { sent: false, reason: "The email could not be sent." };
  }
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f1;font-family:Arial,Helvetica,sans-serif;color:#0f1b2d">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8f6d31;margin:0 0 8px">${escape(CONFIG.SITE_NAME)}</p>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 16px">${escape(title)}</h1>
${bodyHtml}
<p style="font-size:12px;color:#5d6675;margin-top:32px">We will never ask for your UPI PIN, OTP, bank password or card details.</p>
</div></body></html>`;
}

/** One ebook of an order, as listed in emails. */
export type EmailBook = { title: string; languageName: string; state: "ready" | "preparing" | "manual" | "delayed" };

const STATE_TEXT: Record<EmailBook["state"], string> = {
  ready: "Ready to download",
  preparing: "Being prepared",
  manual: "We will send it to you",
  delayed: "Taking a little longer — we are on it",
};

function bookList(books: EmailBook[]) {
  return {
    text: books.map((b) => `• ${b.title} — ${b.languageName}: ${STATE_TEXT[b.state]}`).join("\n"),
    html: `<ul style="padding-left:18px">${books.map((b) => `<li><strong>${escape(b.title)}</strong> — ${escape(b.languageName)}: ${escape(STATE_TEXT[b.state])}</li>`).join("")}</ul>`,
  };
}

export function paymentReceivedEmail(o: { to: string; name: string; ref: string; statusUrl: string; books: EmailBook[] }): Email {
  const [one] = o.books;
  const single = o.books.length === 1;
  const subject = single ? `Payment received — your ${one.languageName} edition of "${one.title}" is being prepared` : "Payment received — your ebooks are being prepared";
  const list = bookList(o.books);
  const intro = single
    ? `Your ${one.languageName} edition of "${one.title}" is currently being prepared. We will send you another email when it is ready.`
    : `Your ebooks:\n\n${list.text}\n\nWe will send you another email when they are ready.`;
  const text = `Hello ${o.name},

Your payment has been received.

${intro}

You can follow ${single ? "its" : "their"} progress here: ${o.statusUrl}

Order reference: ${o.ref}

${CONFIG.SITE_NAME}`;
  const introHtml = single
    ? `<p>Your <strong>${escape(one.languageName)}</strong> edition of <strong>“${escape(one.title)}”</strong> is currently being prepared. We will send you another email when it is ready.</p>`
    : `<p>Your ebooks:</p>${list.html}<p>We will send you another email when they are ready.</p>`;
  const html = layout("Your payment has been received", `
<p>Hello ${escape(o.name)},</p>
${introHtml}
<p><a href="${escape(o.statusUrl)}" style="display:inline-block;background:#0f1b2d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Follow your order</a></p>
<p style="font-size:13px;color:#5d6675">Order reference: ${escape(o.ref)}</p>`);
  return { to: o.to, subject, text, html };
}

export function bookReadyEmail(o: { to: string; name: string; ref: string; statusUrl: string; expiresHours: number; books: EmailBook[] }): Email {
  const [one] = o.books;
  const single = o.books.length === 1;
  const subject = single ? `Your ${one.languageName} edition of "${one.title}" is ready` : "Your ebooks are ready";
  const list = bookList(o.books);
  const text = `Hello ${o.name},

Payment successful.

${single ? `Your ${one.languageName} version of "${one.title}" is ready.` : `Your ebooks:\n\n${list.text}`}

Download ${single ? "your book" : "your ebooks"}: ${o.statusUrl}

This personal link works for ${o.expiresHours} hours. Please do not share it.

Order reference: ${o.ref}

${CONFIG.SITE_NAME}`;
  const html = layout(single ? "Your book is ready!" : "Your ebooks are ready!", `
<p>Hello ${escape(o.name)},</p>
${single ? `<p>Payment successful. Your <strong>${escape(one.languageName)}</strong> version of <strong>“${escape(one.title)}”</strong> is ready.</p>` : `<p>Payment successful. Your ebooks:</p>${list.html}`}
<p><a href="${escape(o.statusUrl)}" style="display:inline-block;background:#1f7a4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">${single ? "Download Book" : "Download Your Ebooks"}</a></p>
<p style="font-size:13px;color:#5d6675">This personal link works for ${o.expiresHours} hours. Please do not share it.<br>Order reference: ${escape(o.ref)}</p>`);
  return { to: o.to, subject, text, html };
}

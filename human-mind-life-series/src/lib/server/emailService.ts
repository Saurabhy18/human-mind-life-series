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

export function paymentReceivedEmail(o: { to: string; name: string; bookTitle: string; languageName: string; ref: string; statusUrl: string }): Email {
  const subject = `Payment received — your ${o.languageName} edition of "${o.bookTitle}" is being prepared`;
  const text = `Hello ${o.name},

Your payment has been received.

Your ${o.languageName} edition of "${o.bookTitle}" is currently being prepared. We will send you another email when it is ready.

You can follow its progress here: ${o.statusUrl}

Order reference: ${o.ref}

${CONFIG.SITE_NAME}`;
  const html = layout("Your payment has been received", `
<p>Hello ${escape(o.name)},</p>
<p>Your <strong>${escape(o.languageName)}</strong> edition of <strong>“${escape(o.bookTitle)}”</strong> is currently being prepared. We will send you another email when it is ready.</p>
<p><a href="${escape(o.statusUrl)}" style="display:inline-block;background:#0f1b2d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Follow your order</a></p>
<p style="font-size:13px;color:#5d6675">Order reference: ${escape(o.ref)}</p>`);
  return { to: o.to, subject, text, html };
}

export function bookReadyEmail(o: { to: string; name: string; bookTitle: string; languageName: string; ref: string; statusUrl: string; expiresHours: number }): Email {
  const subject = `Your ${o.languageName} edition of "${o.bookTitle}" is ready`;
  const text = `Hello ${o.name},

Payment successful.

Your ${o.languageName} version of "${o.bookTitle}" is ready.

Download your book: ${o.statusUrl}

This personal link works for ${o.expiresHours} hours. Please do not share it.

Order reference: ${o.ref}

${CONFIG.SITE_NAME}`;
  const html = layout("Your book is ready!", `
<p>Hello ${escape(o.name)},</p>
<p>Payment successful. Your <strong>${escape(o.languageName)}</strong> version of <strong>“${escape(o.bookTitle)}”</strong> is ready.</p>
<p><a href="${escape(o.statusUrl)}" style="display:inline-block;background:#1f7a4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Download Book</a></p>
<p style="font-size:13px;color:#5d6675">This personal link works for ${o.expiresHours} hours. Please do not share it.<br>Order reference: ${escape(o.ref)}</p>`);
  return { to: o.to, subject, text, html };
}

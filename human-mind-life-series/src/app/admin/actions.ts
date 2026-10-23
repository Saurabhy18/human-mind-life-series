"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminConfigured, createSession, destroySession, requireAdmin, verifyPassword } from "@/lib/server/auth";
import { getOrder, setMessageHandled, updateOrderStatus } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { isOrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/server";
import { isFreeStatus } from "@/lib/free-status";
import { getFreeRequest, updateFreeStatus } from "@/lib/server/free-requests";
import { issueAccessToken, markOrderPaid, markOrderPaymentFailed, retryTranslation, sendReadyEmail, startFulfillment, statusUrl } from "@/lib/server/fulfillment";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!adminConfigured()) return { error: "Admin login is not configured. Set ADMIN_PASSWORD_HASH and SESSION_SECRET in .env.local." };

  const ip = clientIp(await headers());
  const limit = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.` };

  const password = String(formData.get("password") || "");
  if (!password || !verifyPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: "Incorrect password." };
  }
  await createSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  // An admin may also be signed in through their Supabase account; isAdmin() accepts either.
  try {
    await (await createClient()).auth.signOut();
  } catch {
    // Ignore
  }
  redirect("/admin/login");
}

export async function updateStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = formData.get("status");
  const rawNote = String(formData.get("note") || "").trim().slice(0, 1000);
  const order = Number.isInteger(id) ? getOrder(id) : undefined;
  if (!order || !isOrderStatus(status)) throw new Error("Invalid request");

  updateOrderStatus(id, status, rawNote || null);
  // "Payment Verified" by the admin IS the server-side verification: it starts delivery/translation.
  if ((status === "verified" || status === "delivered") && order.payment_status !== "PAID") {
    await markOrderPaid({
      orderId: id,
      provider: order.payment_provider === "cashfree" ? "cashfree" : "manual_upi",
      idempotencyKey: `admin_verification:order:${id}:${status}`,
      amount: order.amount,
      currency: order.currency,
      providerPaymentId: order.utr,
    });
  } else if (status === "delivered" && order.payment_status === "PAID") {
    await startFulfillment(id, { retryFailed: true });
  } else if (status === "rejected" && order.payment_status === "PENDING") {
    markOrderPaymentFailed(id, "Payment rejected by admin");
  }

  // Revalidate both admin views and customer-facing views
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath(`/order/status/${order.ref}`);
  revalidatePath("/dashboard");
}

export async function retryTranslationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const jobId = Number(formData.get("jobId"));
  if (!Number.isInteger(jobId)) throw new Error("Invalid request");
  retryTranslation(jobId);
  revalidatePath("/admin/translations");
  revalidatePath("/admin");
}

export async function restartFulfillmentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || !getOrder(id)) throw new Error("Invalid request");
  await startFulfillment(id, { retryFailed: true });
  revalidatePath(`/admin/orders/${id}`);
}

export type LinkState = { link?: string; message?: string };

/** Creates a new private link for the customer (shown once to the admin, e.g. to send by WhatsApp). */
export async function customerLinkAction(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const order = Number.isInteger(id) ? getOrder(id) : undefined;
  if (!order) return { message: "Order not found." };
  return { link: statusUrl(order.ref, issueAccessToken(id, "admin")) };
}

export async function resendReadyEmailAction(_prev: LinkState, formData: FormData): Promise<LinkState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { message: "Invalid request." };
  const res = await sendReadyEmail(id);
  revalidatePath(`/admin/orders/${id}`);
  return { message: res.sent ? "Email sent." : `Not sent: ${res.reason}` };
}

export async function updateFreeStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = formData.get("status");
  const rawNote = String(formData.get("note") || "").trim().slice(0, 1000);
  if (!Number.isInteger(id) || !isFreeStatus(status) || !getFreeRequest(id)) throw new Error("Invalid request");

  updateFreeStatus(id, status, rawNote || null);
  revalidatePath("/admin/free-requests");
  revalidatePath(`/admin/free-requests/${id}`);
}

export async function toggleMessageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Invalid request");
  setMessageHandled(id, formData.get("handled") === "1");
  revalidatePath("/admin/messages");
}

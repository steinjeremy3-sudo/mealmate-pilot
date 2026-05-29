"use server";

// Marketing-site form actions. Sends to support@mealmatedining.com via
// Resend (see src/lib/email/send.ts — degrades gracefully if
// RESEND_API_KEY isn't set).

import { sendTransactionalEmail } from "@/lib/email/send";

const FOUNDER_INBOX = "support@mealmatedining.com";

export type FormState = {
  ok: boolean;
  message: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Contact form on the marketing site. */
export async function submitContact(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  // Honeypot: bots fill the hidden "company" field; humans never see it.
  // Pretend success so a bot gets no signal, but send nothing.
  if (String(formData.get("company") ?? "").trim()) {
    return { ok: true, message: "Thanks — we'll get back to you shortly." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name) return { ok: false, message: "Name is required." };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email." };
  }
  if (!subject) return { ok: false, message: "Subject is required." };
  if (!message) return { ok: false, message: "Message is required." };
  if (message.length > 5000) {
    return { ok: false, message: "Message is too long." };
  }

  const body =
    `New contact form submission from mealmatedining.app\n\n` +
    `Name:    ${name}\n` +
    `Email:   ${email}\n` +
    `Subject: ${subject}\n\n` +
    `Message:\n${message}\n`;

  const result = await sendTransactionalEmail({
    to: FOUNDER_INBOX,
    subject: `[mealmate] ${subject}`,
    text: body,
    replyTo: email,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: "We couldn't send that. Please email us directly.",
    };
  }

  return { ok: true, message: "Thanks — we'll get back to you shortly." };
}

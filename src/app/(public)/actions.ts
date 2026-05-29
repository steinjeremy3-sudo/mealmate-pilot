"use server";

// Marketing-site form actions. Both send to jeremy@mealmatedining.com
// via Resend (see src/lib/email/send.ts — degrades gracefully if
// RESEND_API_KEY isn't set).

import { sendTransactionalEmail } from "@/lib/email/send";

const FOUNDER_INBOX = "jeremy@mealmatedining.com";

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

/** Launch-list signup at the footer. */
export async function joinLaunchList(
  _prev: FormState | null,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email." };
  }

  const result = await sendTransactionalEmail({
    to: FOUNDER_INBOX,
    subject: "[mealmate] Launch list signup",
    text: `New launch-list signup from mealmatedining.app\n\nEmail: ${email}\n`,
    replyTo: email,
  });

  if (!result.ok) {
    return {
      ok: false,
      message: "Couldn't sign you up just now — try again in a minute.",
    };
  }

  return { ok: true, message: "You're on the list." };
}

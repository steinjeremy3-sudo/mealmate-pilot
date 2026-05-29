// Transactional email via Resend. Used for contact-form + launch-list
// signup on the marketing site. Reads RESEND_API_KEY from env; if it
// isn't set we log the message to the server console and still report
// "success" to the caller so the form UX doesn't break on a missing
// env var. The Vercel function logs will capture the message either
// way, so nothing is ever lost.

import "server-only";

type SendArgs = {
  to: string;
  subject: string;
  /** Plain text body. */
  text: string;
  /** Optional From override. Defaults to noreply@mealmatedining.com. */
  from?: string;
  /** Optional Reply-To, so a forwarded "Reply" goes to the visitor. */
  replyTo?: string;
};

/** Returns true if Resend sent (or we logged it because no key). */
export async function sendTransactionalEmail(
  args: SendArgs,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = args.from ?? "Mealmate <noreply@mealmatedining.com>";

  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set. Logged instead:\n" +
        `  to: ${args.to}\n` +
        `  from: ${from}\n` +
        `  subject: ${args.subject}\n` +
        `  reply-to: ${args.replyTo ?? "(none)"}\n` +
        `  body:\n${args.text}`,
    );
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[email] Resend ${res.status}: ${body}\n  subject: ${args.subject}`,
      );
      return { ok: false, error: `Resend error: ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[email] send failed: ${message}`);
    return { ok: false, error: message };
  }
}

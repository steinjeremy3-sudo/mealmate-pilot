"use client";

// Contact form for the marketing site. Uses React's useActionState
// so the success/error message comes back from the server action
// without any client fetch wiring.

import { useActionState } from "react";

import { submitContact, type FormState } from "@/app/(public)/actions";

const inputClass =
  "w-full rounded-lg border border-border bg-bone px-3.5 py-3 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paprika";

const labelClass =
  "mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    submitContact,
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-paprika/30 bg-paprika-tint p-8 text-center">
        <p className="font-display text-2xl text-ink">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* Honeypot: hidden from people, tempting to bots. A real submission
          leaves this empty; the server silently drops anything that fills
          it. aria-hidden + tabIndex keep it away from humans + AT. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="cf-company">Company</label>
        <input
          id="cf-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className={labelClass}>
            Name
          </label>
          <input
            id="cf-name"
            name="name"
            required
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cf-email" className={labelClass}>
            Email
          </label>
          <input
            id="cf-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="cf-subject" className={labelClass}>
          Subject
        </label>
        <input
          id="cf-subject"
          name="subject"
          required
          placeholder="Restaurant operator · diner · other"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cf-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="cf-message"
          name="message"
          rows={5}
          required
          className={inputClass + " resize-y"}
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-ink py-3.5 text-sm font-semibold text-bone transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message →"}
      </button>
    </form>
  );
}

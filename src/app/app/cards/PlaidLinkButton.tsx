"use client";

// Client component that opens Plaid Link with the server-generated
// link_token. On successful linking it forwards the public_token to
// our server action, which exchanges + writes to DB, then refreshes.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

import { exchangePublicToken } from "./actions";

export function PlaidLinkButton({ linkToken }: { linkToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSuccess = useCallback(
    (publicToken: string) => {
      setError(null);
      startTransition(async () => {
        try {
          await exchangePublicToken(publicToken);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save card.");
        }
      });
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      // No-op: user closed Plaid Link without finishing.
    },
  });

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready || pending}
        className="cursor-pointer w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Link a card"}
      </button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

// Client component that opens Plaid Link with the server-generated
// link_token. On successful linking it forwards the public_token to
// our server action, which exchanges + writes to DB, then refreshes.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

import { Button } from "@/components/brand";

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
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => open()}
        disabled={!ready || pending}
      >
        {pending ? "Saving…" : "Link a card"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

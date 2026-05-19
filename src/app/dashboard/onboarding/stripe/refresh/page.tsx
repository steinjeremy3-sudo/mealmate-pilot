// Stripe Connect "refresh" URL. Stripe redirects here if the
// AccountLink expired before the merchant finished. We just generate
// a fresh link and bounce them back into the hosted flow.

import { startStripeOnboarding } from "../actions";

export default async function StripeOnboardingRefresh() {
  // Calling the server action throws via redirect(), so this never
  // actually renders. The form-less invocation is fine — startStripeOnboarding
  // re-uses any existing Stripe account and creates a new AccountLink.
  await startStripeOnboarding();
}

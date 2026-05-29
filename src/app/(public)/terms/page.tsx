// Terms of Service. Lives in the (public) group so it's reachable
// without auth and from the footer — Stripe Connect onboarding also
// requires a public TOS URL.

import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc } from "@/components/public/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service · Mealmate",
  description: "The terms that govern your use of Mealmate.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" lastUpdated="May 29, 2026">
      <section>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of
          Mealmate, operated by Mealmate Inc. (&ldquo;Mealmate,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or
          using the service, you agree to these Terms.
        </p>
      </section>

      <section>
        <h2>What Mealmate does</h2>
        <p>
          Mealmate is a card-linked discount platform. Diners link a
          payment card, activate an offer from a participating
          restaurant, dine and pay normally at the restaurant, and later
          receive cash back to a payout destination they choose. Mealmate
          does not process your payment at the restaurant and is not a
          party to the transaction between you and the restaurant.
        </p>
      </section>

      <section>
        <h2>Eligibility &amp; accounts</h2>
        <ul>
          <li>You must be at least 18 and able to form a binding contract.</li>
          <li>
            You&apos;re responsible for the accuracy of the information you
            provide and for activity under your account.
          </li>
          <li>
            We may suspend or close accounts that violate these Terms or
            that we reasonably believe are engaged in fraud or abuse.
          </li>
        </ul>
      </section>

      <section>
        <h2>For diners</h2>
        <ul>
          <li>
            <strong>Linking a card.</strong> You link a card through our
            payments partner, Plaid. We use this connection to read the
            transaction data needed to recognize a qualifying visit. We
            never see or store your full card number or bank login
            credentials.
          </li>
          <li>
            <strong>Activating an offer.</strong> Each offer has its own
            terms — discount percentage, eligible days and hours, minimum
            check, and any caps. The discount applies to your whole check,
            not to specific menu items. A visit qualifies only when it
            falls within the offer&apos;s window.
          </li>
          <li>
            <strong>Cash back &amp; our fee.</strong> After a qualifying
            visit is recognized, we send you cash back equal to the offer
            discount, less a platform fee. The fee is 6% of the discounted
            total, with a $0.50 minimum and a $10.00 maximum. The fee is
            disclosed before you activate.
          </li>
          <li>
            <strong>Payout.</strong> Cash back is paid to the destination
            you set up (currently a bank account via our partner Dwolla)
            and typically arrives within 1–2 business days after a visit
            is recognized. Recognizing a visit depends on when your card
            transaction is reported to us, which can take a few days.
          </li>
          <li>
            We may withhold or reverse cash back for transactions that are
            reversed, disputed, fraudulent, or that don&apos;t actually
            qualify.
          </li>
        </ul>
      </section>

      <section>
        <h2>For restaurants</h2>
        <ul>
          <li>
            You set your own offers and fund the discounts you offer. You
            can pause or change an offer at any time, effective going
            forward.
          </li>
          <li>
            You onboard for payouts and verification through Stripe
            Connect and agree to the{" "}
            <a
              href="https://stripe.com/connect-account/legal"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe Connected Account Agreement
            </a>
            .
          </li>
          <li>
            Each week we invoice you for the sum of the discounts on
            qualifying visits during the period. You authorize us to
            collect those amounts via Stripe.
          </li>
          <li>
            You&apos;re responsible for honoring offers you publish and for
            the accuracy of your restaurant&apos;s information.
          </li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Don&apos;t misuse the service — including attempting to game
          matching, creating fake visits, scraping, interfering with the
          platform, or using it to break the law.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          Mealmate relies on partners including Plaid (card linking and
          transaction data), Dwolla (diner payouts), and Stripe
          (restaurant onboarding and settlement). Your use of those
          features is also subject to those partners&apos; terms.
        </p>
      </section>

      <section>
        <h2>Disclaimers &amp; liability</h2>
        <p>
          The service is provided &ldquo;as is.&rdquo; To the fullest
          extent permitted by law, Mealmate disclaims implied warranties
          and is not liable for indirect or consequential damages. Nothing
          here limits liability that cannot be limited under law.
        </p>
      </section>

      <section>
        <h2>Changes &amp; termination</h2>
        <p>
          We may update these Terms; material changes will be posted here
          with a new &ldquo;last updated&rdquo; date. You may stop using
          Mealmate at any time, and we may suspend or end access as
          described above.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of Texas,
          without regard to conflict-of-laws rules.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these Terms? Reach us at{" "}
          <a href="mailto:support@mealmatedining.com">
            support@mealmatedining.com
          </a>{" "}
          or through the{" "}
          <Link href="/for-restaurants#contact">contact form</Link>.
        </p>
      </section>
    </LegalDoc>
  );
}

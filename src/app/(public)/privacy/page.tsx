// Privacy Policy. Public + footer-linked. A card-linked product that
// reads bank-transaction data needs this both for user trust and for
// payment-partner / app-store requirements.

import type { Metadata } from "next";
import Link from "next/link";

import { LegalDoc } from "@/components/public/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy · Mealmate",
  description: "How Mealmate collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" lastUpdated="May 29, 2026">
      <section>
        <p>
          This Privacy Policy explains what Mealmate Inc.
          (&ldquo;Mealmate,&rdquo; &ldquo;we&rdquo;) collects, how we use
          it, and the choices you have. It applies to diners and
          restaurant users of the Mealmate platform.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account information</strong> — your name, email, and
            (for restaurants) business details you provide.
          </li>
          <li>
            <strong>Card &amp; transaction data</strong> — when you link a
            card through Plaid, we receive a secure access token and the
            transaction details needed to recognize qualifying visits
            (merchant name, amount, date, and the card&apos;s last four).
            We do <strong>not</strong> receive or store your full card
            number or your bank login credentials.
          </li>
          <li>
            <strong>Payout information</strong> — the destination you set
            up to receive cash back, handled through our partner Dwolla.
          </li>
          <li>
            <strong>Restaurant payout/verification data</strong> —
            collected directly by Stripe during Connect onboarding.
          </li>
          <li>
            <strong>Usage &amp; device data</strong> — basic logs and
            technical information generated when you use the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To operate the platform — recognize qualifying visits, calculate and send cash back, and settle with restaurants.</li>
          <li>To verify identity and prevent fraud and abuse.</li>
          <li>To communicate with you about your account, visits, and payouts.</li>
          <li>To comply with legal and payment-network obligations.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal information.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          We share data with service providers strictly to run Mealmate,
          including:
        </p>
        <ul>
          <li><strong>Plaid</strong> — card linking and transaction data.</li>
          <li><strong>Dwolla</strong> — diner cash-back payouts.</li>
          <li><strong>Stripe</strong> — restaurant onboarding and weekly settlement.</li>
          <li><strong>Supabase</strong> — our database and authentication.</li>
          <li><strong>Resend</strong> — transactional email.</li>
          <li><strong>Vercel</strong> — hosting.</li>
        </ul>
        <p>
          We may also disclose information if required by law or to protect
          the rights and safety of users and the public.
        </p>
      </section>

      <section>
        <h2>How we protect it</h2>
        <p>
          Sensitive tokens (such as your Plaid access token) are encrypted
          at rest. Access to data is restricted and enforced at the
          database level. No system is perfectly secure, but we take
          reasonable measures to safeguard your information.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          We keep your information for as long as your account is active
          and as needed for the purposes above, including legal,
          accounting, and fraud-prevention obligations.
        </p>
      </section>

      <section>
        <h2>Your choices &amp; rights</h2>
        <ul>
          <li>
            You can unlink a card at any time, which stops us from
            receiving further transaction data for it.
          </li>
          <li>
            You can request access to, correction of, or deletion of your
            personal data by emailing us. We&apos;ll honor applicable
            requests; some data may be retained where required by law.
          </li>
        </ul>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update this policy; material changes will be posted here
          with a new &ldquo;last updated&rdquo; date.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions or data requests:{" "}
          <a href="mailto:support@mealmatedining.com">
            support@mealmatedining.com
          </a>{" "}
          or via the{" "}
          <Link href="/for-restaurants#contact">contact form</Link>.
        </p>
      </section>
    </LegalDoc>
  );
}

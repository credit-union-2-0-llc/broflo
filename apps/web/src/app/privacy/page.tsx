import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Broflo",
};

// ⚠️ DRAFT — NOT legal advice and NOT reviewed by counsel. This is an honest
// starting template describing Broflo's actual data practices. Before launch:
// (1) have a lawyer review it, and (2) replace every {{PLACEHOLDER}} with real
// values. Do not merge/deploy as the live policy until that's done.
const EFFECTIVE_DATE = "{{EFFECTIVE_DATE}}";
const LEGAL_ENTITY = "{{LEGAL_ENTITY_NAME}}";
const CONTACT_EMAIL = "{{PRIVACY_CONTACT_EMAIL}}";
const MAILING_ADDRESS = "{{MAILING_ADDRESS}}";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-cream">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to Broflo</Link>
      <h1 className="mt-6 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          This Privacy Policy explains how {LEGAL_ENTITY} (&ldquo;Broflo,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
          collects, uses, and shares information when you use Broflo (the &ldquo;Service&rdquo;).
        </p>

        <section>
          <h2 className="text-lg font-semibold">Information we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Account information</strong> — your email address, and a password if you set one.</li>
            <li><strong>Information you add about others</strong> — the names, relationships, occasions, preferences,
              notes, and shipping addresses you enter about the people you buy gifts for.</li>
            <li><strong>Payment information</strong> — processed by our payment provider (Stripe). We do not store
              full card numbers.</li>
            <li><strong>Usage and device data</strong> — basic technical information generated when you use the
              Service (e.g. log data), used to operate and secure it.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">How we use information</h2>
          <p className="mt-2">
            To provide and improve the Service (including generating gift suggestions), process subscription
            payments, send you transactional messages (such as sign-in and verification emails), and keep the
            Service secure. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Service providers</h2>
          <p className="mt-2">
            We share information with vendors who process it on our behalf to run the Service, including: Stripe
            (payments), Resend (transactional email), Anthropic (AI-generated suggestions), Exa (product search),
            and Microsoft Azure (hosting). These providers are bound to use the information only to provide their
            services to us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Data retention &amp; your choices</h2>
          <p className="mt-2">
            We keep your information for as long as your account is active or as needed to provide the Service and
            meet legal obligations. You can access, correct, or delete your data, or close your account, by
            contacting us at {CONTACT_EMAIL}. Deleting a person or your account removes the associated data from
            our active systems.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Security</h2>
          <p className="mt-2">
            We use technical and organizational measures to protect your information. No system is perfectly
            secure, but we work to safeguard the data you entrust to us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Children</h2>
          <p className="mt-2">
            Broflo is not directed to children under 13 (or the minimum age in your jurisdiction), and we do not
            knowingly collect their personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="mt-2">
            We may update this policy from time to time. We&apos;ll post the updated version here and revise the
            effective date above.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2">
            Questions? Email {CONTACT_EMAIL}{MAILING_ADDRESS ? `, or write to us at ${MAILING_ADDRESS}` : ""}.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service →</Link>
      </p>
    </main>
  );
}

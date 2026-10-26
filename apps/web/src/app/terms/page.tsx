import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Broflo",
};

// ⚠️ DRAFT — NOT legal advice and NOT reviewed by counsel. This is an honest
// starting template describing how Broflo actually works. Before launch:
// (1) have a lawyer review it, and (2) replace every {{PLACEHOLDER}} with real
// values. Do not merge/deploy as the live terms until that's done.
const EFFECTIVE_DATE = "{{EFFECTIVE_DATE}}";
const LEGAL_ENTITY = "{{LEGAL_ENTITY_NAME}}";
const CONTACT_EMAIL = "{{SUPPORT_CONTACT_EMAIL}}";
const GOVERNING_LAW = "{{GOVERNING_LAW_JURISDICTION}}";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-cream">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to Broflo</Link>
      <h1 className="mt-6 text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective {EFFECTIVE_DATE}</p>

      <div className="prose prose-invert mt-8 space-y-6 text-sm leading-relaxed">
        <p>
          These Terms govern your use of Broflo (the &ldquo;Service&rdquo;), provided by {LEGAL_ENTITY}
          (&ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or using the Service, you agree to these Terms.
        </p>

        <section>
          <h2 className="text-lg font-semibold">What Broflo is</h2>
          <p className="mt-2">
            Broflo is a subscription gift-concierge service. It suggests gift ideas and provides links to
            third-party retailers where you can buy them. <strong>Broflo is not a store</strong> — we do not sell
            or ship products. Any purchase you make is a transaction directly between you and the retailer, subject
            to that retailer&apos;s own terms, pricing, and availability.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Accounts</h2>
          <p className="mt-2">
            You&apos;re responsible for keeping your account credentials secure and for activity under your account.
            Provide accurate information and keep it up to date. You must be old enough to form a binding contract
            in your jurisdiction to use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Subscriptions &amp; billing</h2>
          <p className="mt-2">
            Paid plans are billed in advance on a recurring basis (monthly or annually) through our payment
            provider, Stripe, and renew automatically until cancelled. You can cancel anytime from your billing
            settings; cancellation takes effect at the end of the current billing period. Except where required by
            law, payments are non-refundable. Prices may change with notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Acceptable use</h2>
          <p className="mt-2">
            Don&apos;t misuse the Service — including attempting to disrupt it, access it without authorization, or
            use it for unlawful purposes, or entering others&apos; personal information without a legitimate basis
            to do so.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">AI suggestions &amp; third parties</h2>
          <p className="mt-2">
            Gift suggestions are automated recommendations and may be imperfect, unavailable, or inaccurately
            priced. We are not responsible for third-party retailers, their products, prices, or fulfillment.
            Verify details before you buy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Disclaimers &amp; limitation of liability</h2>
          <p className="mt-2">
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind, to the fullest extent
            permitted by law. To the extent permitted by law, we are not liable for indirect, incidental, or
            consequential damages, and our total liability is limited to the amount you paid us in the twelve months
            before the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Termination</h2>
          <p className="mt-2">
            You may stop using the Service and close your account at any time. We may suspend or terminate access if
            you violate these Terms or to protect the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Changes &amp; governing law</h2>
          <p className="mt-2">
            We may update these Terms; continued use after an update means you accept the revised Terms. These Terms
            are governed by the laws of {GOVERNING_LAW}, without regard to conflict-of-law rules.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2">Questions about these Terms? Email {CONTACT_EMAIL}.</p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy →</Link>
      </p>
    </main>
  );
}

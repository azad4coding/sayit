import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — SayIt",
  description: "How SayIt collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  const lastUpdated = "May 7, 2026";

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 13, textDecoration: "none", marginBottom: 20 }}>
            ← Back to SayIt
          </Link>
          <h1 style={{ color: "white", fontSize: 28, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 }}>Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, margin: 0 }}>Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "32px 28px", boxShadow: "0 2px 20px rgba(0,0,0,0.06)", lineHeight: 1.75, color: "#374151", fontSize: 15 }}>

          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
            SayIt (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights.
          </p>

          <Section title="1. Information We Collect">
            <p><strong>Account Information:</strong> When you sign up, we collect your name, email address, and optionally your phone number. If you sign in via Google, we receive your name and email from Google.</p>
            <p><strong>Cards You Send & Receive:</strong> We store the greeting cards you create, including your message, the template chosen, and the recipient&apos;s name and phone number.</p>
            <p><strong>Photos:</strong> If you use Paw Moments or Custom Card features, photos you upload are stored securely on our servers.</p>
            <p><strong>Usage Data:</strong> We collect basic analytics such as which features are used, to help us improve the app. We do not sell this data.</p>
            <p><strong>Push Notification Tokens:</strong> If you enable notifications, we store your device push token to send you card delivery alerts.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Deliver cards to recipients within the app</li>
              <li>Send you notifications when you receive a card or someone reacts to yours</li>
              <li>Let friends find you by phone number within SayIt</li>
              <li>Improve our app features and fix bugs</li>
              <li>Respond to your support requests</li>
            </ul>
            <p>We do <strong>not</strong> use your data for advertising or sell it to third parties.</p>
          </Section>

          <Section title="3. How We Share Your Information">
            <p>We share your information only in the following limited circumstances:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>With recipients:</strong> When you send a card, the recipient sees your name and message.</li>
              <li><strong>Service providers:</strong> We use Supabase (database and authentication), Vercel (hosting), and OpenAI (AI card generation). These providers process data only as needed to provide their services.</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law.</li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <p>Cards are stored for <strong>30 days</strong> after being sent, then automatically expired. Your account data is retained as long as your account is active. You can request deletion at any time by contacting us.</p>
          </Section>

          <Section title="5. Your Rights">
            <p>You have the right to:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt out of push notifications at any time via your device settings</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:support@sayit.app" style={{ color: "#FF6B8A" }}>support@sayit.app</a>.</p>
          </Section>

          <Section title="6. Children's Privacy">
            <p>SayIt is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>
          </Section>

          <Section title="7. Security">
            <p>We take reasonable measures to protect your information, including encrypted data transmission (HTTPS) and secure storage via Supabase. However, no method of transmission over the internet is 100% secure.</p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>SayIt uses the following third-party services, each with their own privacy policies:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B8A" }}>Supabase</a> — database and authentication</li>
              <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B8A" }}>Vercel</a> — hosting and deployment</li>
              <li><a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B8A" }}>OpenAI</a> — AI card image generation</li>
              <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B8A" }}>Google</a> — sign-in authentication</li>
            </ul>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this privacy policy from time to time. We will notify you of significant changes by updating the date at the top of this page. Continued use of SayIt after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>If you have any questions about this privacy policy, please contact us:</p>
            <p>
              <strong>Email:</strong> <a href="mailto:support@sayit.app" style={{ color: "#FF6B8A" }}>support@sayit.app</a><br />
              <strong>App:</strong> <a href="https://sayit-gamma.vercel.app" style={{ color: "#FF6B8A" }}>sayit-gamma.vercel.app</a>
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", margin: "0 0 10px", paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>
        {title}
      </h2>
      <div style={{ color: "#4b5563" }}>{children}</div>
    </div>
  );
}

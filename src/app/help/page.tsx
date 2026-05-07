import Link from "next/link";

export const metadata = {
  title: "Help & Support — SayIt",
  description: "Get help with SayIt — sending cards, account issues, and more.",
};

const faqs = [
  {
    q: "How do I send a card?",
    a: "Tap any card category on the home screen, pick a template you love, write your message, then tap Send. You can send directly to a SayIt friend or share a link via WhatsApp or SMS to anyone.",
  },
  {
    q: "Can I send cards to people who don't have SayIt?",
    a: "Yes! Share a card link via WhatsApp or SMS. The recipient can open and view the card in their browser. They'll also see an option to join SayIt for free to send one back.",
  },
  {
    q: "How do I add my phone number?",
    a: "Go to Profile → Add Phone Number. Enter your country code and number, then verify with the OTP sent to your phone. This lets friends find you on SayIt.",
  },
  {
    q: "Why isn't my OTP arriving?",
    a: "Check that you've entered the correct country code and number. OTPs can take up to 2 minutes. If it still doesn't arrive, tap Resend Code. Make sure your number can receive SMS.",
  },
  {
    q: "How long are cards available?",
    a: "Cards are available for 30 days after being sent. After that they expire and can no longer be viewed.",
  },
  {
    q: "How do I react to a card?",
    a: "Open the card and tap one of the emoji reactions at the bottom. The sender will get a notification that you reacted. Tap your reaction again to remove it.",
  },
  {
    q: "How do I create a Paw Moments card?",
    a: "Tap Paw Moments on the home screen, upload 1–5 photos of your pet, choose a frame style, add a message, and send. It's the perfect way to share your furry friend.",
  },
  {
    q: "What is the AI Card Creator?",
    a: "The AI Card Creator uses DALL-E to generate a unique card image based on your description. Describe a scene or feeling, pick a style, and SayIt will create a one-of-a-kind card just for that moment.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Profile → scroll to the bottom → Delete Account. This permanently removes your account and all associated data. This action cannot be undone.",
  },
  {
    q: "I found a bug or have a suggestion.",
    a: "We'd love to hear from you! Email us at support@sayit.app with details and we'll get back to you as soon as possible.",
  },
];

export default function HelpPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 13, textDecoration: "none", marginBottom: 20 }}>
            ← Back to SayIt
          </Link>
          <h1 style={{ color: "white", fontSize: 28, fontWeight: 800, margin: "0 0 8px", letterSpacing: -0.5 }}>Help & Support</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, margin: 0 }}>Answers to common questions about SayIt</p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* FAQs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ background: "white", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1f2937", margin: "0 0 8px" }}>
                {faq.q}
              </h3>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.65 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div style={{ marginTop: 32, background: "linear-gradient(135deg,#FF6B8A15,#9B59B615)", borderRadius: 20, padding: "28px 24px", textAlign: "center", border: "1px solid rgba(255,107,138,0.15)" }}>
          <p style={{ fontSize: 22, margin: "0 0 8px" }}>💌</p>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1f2937", margin: "0 0 8px" }}>Still need help?</h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6 }}>
            Our team is happy to help. Drop us an email and we&apos;ll get back to you within 24 hours.
          </p>
          <a href="mailto:support@sayit.app"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 30, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(255,107,138,0.35)" }}>
            Email Support
          </a>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "16px 0 0" }}>
            <a href="/privacy" style={{ color: "#9ca3af" }}>Privacy Policy</a>
          </p>
        </div>

      </div>
    </div>
  );
}

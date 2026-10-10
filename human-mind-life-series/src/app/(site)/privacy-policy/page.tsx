import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_EMAIL, CONFIG, SITE_URL } from "@/config/site.config";
import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How The Human Mind & Life Series collects, uses and protects your personal information.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  const analyticsOn = !!(CONFIG.GOOGLE_ANALYTICS_ID || CONFIG.GOOGLE_ADS_ID || CONFIG.META_PIXEL_ID);
  // Only claim HTTPS for a production build with a real https:// domain configured — never for a local or placeholder site.
  const httpsSite = process.env.NODE_ENV === "production" && SITE_URL.startsWith("https://") && !SITE_URL.includes("example.com");
  return (
    <LegalPage title="Privacy Policy" intro="Your privacy matters to us. This policy explains what information we collect, why we collect it and how we protect it.">
      <p>
        This website is operated by {CONFIG.PUBLISHER_NAME} (“we”, “us”, “our”) to sell the books of {CONFIG.SITE_NAME}. By using this website or
        submitting your details, you agree to the practices described in this policy. We handle personal data in line with applicable Indian law,
        including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Information you give us when you buy a book</h3>
      <ul>
        <li><strong>Name</strong> — to identify your order.</li>
        <li><strong>Email address</strong> — to deliver your book and contact you about your order.</li>
        <li><strong>WhatsApp number</strong> — to deliver your book and contact you about your order.</li>
        <li><strong>Book purchased and amount</strong> — to process your order.</li>
        <li>
          <strong>Payment information you submit</strong> — your UPI UTR / Transaction ID, so that we can match your payment with our bank records.
        </li>
        <li>
          <strong>Payment screenshot</strong> — the image you upload as proof of payment. It may show details such as your name, UPI ID, bank name, amount,
          date and transaction ID.
        </li>
      </ul>
      <h3>Information you give us when you request a free book</h3>
      <p>
        Your name, email address, optional WhatsApp number, the free book you requested and the date of your request, so that we can send you the book
        and help with your request. No payment information is collected for free books. If you download the book through a personal download link, we
        record how many times the link has been used.
      </p>
      <h3>Information you give us when you contact us</h3>
      <p>Your name, email address, optional phone number and the content of your message.</p>
      <h3>Information collected automatically</h3>
      <p>
        For security and to prevent fraud, we record the date and time of your submission, your browser type and a one-way (hashed) version of your IP
        address. If you arrived from an advertisement, we also record the campaign information contained in the link (such as UTM parameters, Google
        click ID or Facebook click ID), the page you landed on and the referring website.
      </p>

      <h2>2. Information we never collect</h2>
      <p>
        We <strong>never</strong> ask for, collect or store your UPI PIN, OTP, bank or net-banking password, debit/credit card number, CVV or card PIN.
        Payments are made directly from your UPI app to our UPI ID; we do not process payments on this website. If anyone claiming to represent us asks
        for these details, please do not share them and report it to us.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To verify your payment and process your order.</li>
        <li>To deliver your purchased or free book to your email address and/or WhatsApp number.</li>
        <li>To respond to your questions, support requests and enquiries.</li>
        <li>To prevent fraud, duplicate submissions and misuse of the website.</li>
        <li>To understand which advertising campaigns bring visitors and sales, so we can improve our marketing.</li>
        <li>To meet our legal, tax and accounting obligations.</li>
      </ul>
      <p>We do not sell or rent your personal information to anyone. We will not send you marketing messages without your consent.</p>

      <h2>4. Cookies, analytics and advertising</h2>
      {analyticsOn ? (
        <p>This website uses the following third-party services, which may set cookies or similar technologies in your browser:</p>
      ) : (
        <p>This website may use the following third-party services, which may set cookies or similar technologies in your browser:</p>
      )}
      <ul>
        <li><strong>Google Analytics</strong> — to understand how visitors use the website (pages viewed, approximate location, device type).</li>
        <li><strong>Google Ads conversion tracking</strong> — to measure the effectiveness of our Google advertisements.</li>
        <li><strong>Meta Pixel</strong> (Facebook / Instagram) — to measure the effectiveness of our Facebook and Instagram advertisements.</li>
      </ul>
      <p>
        These services receive information such as the pages you visit, the book you view and the fact that a purchase form was submitted, together with
        its value. They do <strong>not</strong> receive your name, email address, WhatsApp number, UTR or payment screenshot. The website also stores
        campaign information in your browser’s local storage for up to 30 days so that a later order can be linked to the advertisement that brought you
        here. You can block or delete cookies and local storage in your browser settings, and you can learn more or opt out at{" "}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Google’s ad settings</a> and{" "}
        <a href="https://www.facebook.com/settings?tab=ads" target="_blank" rel="noopener noreferrer">Meta’s ad preferences</a>.
      </p>

      <h2>5. Who can see your information</h2>
      <p>
        Your order details and payment screenshot are visible only to us through a password-protected admin area. They are never displayed publicly and
        other customers cannot access them. We may share information only with service providers that help us operate the website (such as our hosting
        provider), with your bank or payment provider if needed to resolve a payment issue, or where required by law.
      </p>

      <h2>6. Data security</h2>
      <ul>
        {httpsSite && <li>The website is served over a secure, encrypted HTTPS connection.</li>}
        <li>Payment screenshots are stored in private storage that cannot be accessed through a public web address.</li>
        <li>Uploaded files are checked to ensure they are genuine image files and are renamed with random names.</li>
        <li>The admin area is protected by a password and secure, time-limited sessions.</li>
        <li>Forms are protected against automated spam and repeated abuse.</li>
      </ul>
      <p>No method of storage or transmission over the internet is completely secure, but we take reasonable steps to protect your information.</p>

      <h2>7. How long we keep your information</h2>
      <p>
        We keep order information for as long as necessary to provide your book, handle any support request or dispute, and meet legal, tax and
        accounting requirements. Payment screenshots are deleted once they are no longer needed for these purposes. Contact-form messages are kept only as
        long as needed to respond to you.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You may ask us to access, correct or delete your personal information, or withdraw your consent, by contacting us using the details below. We may
        need to keep certain information where required by law. We will respond to your request within a reasonable time.
      </p>

      <h2>9. Children</h2>
      <p>
        This website is not directed at children. Purchases should be made by adults. Volume 5 of the series and The Intimacy Code are intended only for readers aged 18 and above.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>We may update this policy from time to time. The latest version will always be available on this page with its “last updated” date.</p>

      <h2>11. Contact us</h2>
      <p>
        For any privacy question or request, please email us at <strong>{BUSINESS_EMAIL}</strong>
        {CONFIG.WHATSAPP_NUMBER && !CONFIG.WHATSAPP_NUMBER.startsWith("[") ? <> or message us on WhatsApp at <strong>+{CONFIG.WHATSAPP_NUMBER}</strong></> : null}, or
        use our <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}

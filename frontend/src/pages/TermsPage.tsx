import React from "react";
import PageHero from "../components/PageHero";

const TermsPage: React.FC = () => {
  return (
    <div className="page legal-page">
      <PageHero title="Terms of Service" subtitle="Last updated: 7 February 2026" />

      <div className="legal-wrap">
        <h2>1. Who we are</h2>
        <p>Aim2Build is operated by:</p>
        <p>
          <strong>Legal entity:</strong> Aim2 Ltd<br />
          <strong>Registered address:</strong> Aim2 Ltd, 49 Dumers Lane, Radcliffe, Manchester M26 2QE, United Kingdom<br />
          <strong>Contact email:</strong> <a href="mailto:support@aim2build.co.uk">support@aim2build.co.uk</a>
        </p>

        <h2>2. What Aim2Build does</h2>
        <p>
          Aim2Build is a LEGO inventory and buildability platform that helps users understand what they can build
          using the bricks they already own. Aim2Build is not affiliated with or endorsed by the LEGO Group.
        </p>

        <h2>3. Accounts</h2>
        <p>
          Some features require an account. You are responsible for maintaining the confidentiality of your login
          details and for activity under your account.
        </p>

        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not misuse the service or attempt unauthorised access.</li>
          <li>Do not upload unlawful, harmful, or misleading content.</li>
          <li>Do not scrape, reverse engineer, or abuse our data or services.</li>
        </ul>

        <h2>5. Third-party services (including TikTok)</h2>
        <p>
          If you connect third-party services (such as TikTok), you authorise Aim2Build to access the data necessary
          to provide that feature. Use of third-party services is also governed by their own terms.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          Aim2Build software, branding, and content (excluding your own content) is owned by Aim2 Ltd and may not be
          copied or reused without permission.
        </p>

        <h2>7. Changes and availability</h2>
        <p>
          We may modify, suspend, or discontinue parts of the service. We may update these Terms from time to time.
          Continued use means you accept the updated terms.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          Aim2Build is provided "as is". To the extent permitted by law, we are not liable for indirect, incidental,
          or consequential losses arising from use of the service.
        </p>

        <h2>9. Governing law</h2>
        <p>These Terms are governed by the laws of England and Wales.</p>

        <h2>10. Contact</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:support@aim2build.co.uk">support@aim2build.co.uk</a>.
        </p>
      </div>
    </div>
  );
};

export default TermsPage;

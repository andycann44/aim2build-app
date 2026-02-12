import React from "react";

type Props = {
  className?: string;
};

const Footer: React.FC<Props> = ({ className }) => {
  const tiktok = "https://www.tiktok.com/@aim2build.co.uk";
  const instagram = "https://www.instagram.com/Aim2Build.co.uk"; 
  const facebook = "https://www.facebook.com/profile.php?id=61586574412471";

  return (
    <footer className={className ? `a2b-footer ${className}` : "a2b-footer"}>
      <div className="a2b-footer-inner">
        <div className="a2b-footer-left">
          <span className="a2b-footer-brand">Aim2Build</span>
          <span className="a2b-footer-dot">•</span>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>

        <div className="a2b-footer-right">
          <a className="a2b-footer-icon" href={tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M16.7 7.2c-.8-.9-1.3-2-1.4-3.2h-2.9v12.1c0 1.2-1 2.1-2.1 2.1-1.2 0-2.1-1-2.1-2.1 0-1.2 1-2.1 2.1-2.1.2 0 .4 0 .6.1V11c-.2 0-.4-.1-.6-.1-2.8 0-5.1 2.3-5.1 5.1S6.4 21 9.2 21s5.1-2.3 5.1-5.1V9.8c1 .7 2.2 1.1 3.5 1.1V8c-.4 0-.8-.1-1.1-.2z"/>
            </svg>
          </a>

          <a className="a2b-footer-icon" href={instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5zM17.8 6.2a.8.8 0 1 1-.8.8.8.8 0 0 1 .8-.8z"/>
            </svg>
          </a>

          <a className="a2b-footer-icon" href={facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M13.5 22v-8h2.7l.4-3H13.5V9.1c0-.9.3-1.6 1.7-1.6h1.5V4.8c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.5v8h4z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

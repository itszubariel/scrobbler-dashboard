import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const devUser = import.meta.env.VITE_DEV_BYPASS_USER;

  useEffect(() => {
    if (devUser) {
      navigate(`/user/${devUser}`);
    }
  }, []);

  useEffect(() => {}, []);

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    if (isDark) {
      html.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    } else {
      html.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
  }

  return (
    <>
      <nav className="nav-bar">
        <div className="nav-inner">
          <span className="nav-wordmark">scrobbler</span>
          <div className="nav-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <svg
                className="icon-moon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <svg
                className="icon-sun"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>
            <a href="https://scrobbler.netlify.app" className="nav-btn">
              main site
            </a>
          </div>
        </div>
      </nav>

      <main
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "90vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <div>
          <div className="eyebrow-pill">✦ scrobbler dashboard</div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: "clamp(72px, 14vw, 140px)",
              fontWeight: 400,
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              marginBottom: 24,
              textTransform: "lowercase",
            }}
          >
            <span className="gradient-text">scrobbler</span>
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              opacity: 0.7,
              maxWidth: 480,
              margin: "0 auto 40px",
              fontFamily: "var(--font-body)",
            }}
          >
            your scrobbler stats, charts, and server comparisons. login with
            discord to get started.
          </p>

          <a
            href={`https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + "/callback")}&response_type=code&scope=identify`}
            className="btn"
          >
            login with discord →
          </a>
        </div>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('DOMContentLoaded',function(){document.body.classList.add('is-loaded')})`,
        }}
      />
    </>
  );
}

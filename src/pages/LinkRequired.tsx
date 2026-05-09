import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LinkRequired() {
  const navigate = useNavigate();
  const [discordUsername, setDiscordUsername] = useState("");

  useEffect(() => {
    // Check if user is authenticated
    fetch("/api/auth-check")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          navigate("/");
        } else if (data.hasLastfm) {
          // They actually have Last.fm linked, redirect to dashboard
          navigate(`/user/${data.lastfmUsername}`);
        } else {
          setDiscordUsername(data.discordUsername);
        }
      })
      .catch(() => {
        navigate("/");
      });
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: "600px", textAlign: "center" }}>
        <div className="eyebrow-pill" style={{ marginBottom: "24px" }}>
          ✦ last.fm not linked
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "clamp(48px, 8vw, 72px)",
            fontWeight: 400,
            lineHeight: 0.92,
            marginBottom: "24px",
            textTransform: "lowercase",
          }}
        >
          <span className="gradient-text">link your account</span>
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            opacity: 0.7,
            marginBottom: "32px",
          }}
        >
          hey {discordUsername ? <strong>{discordUsername}</strong> : "there"}!
          you need to link your Last.fm account to the scrobbler bot before you
          can use the dashboard.
        </p>

        <div
          style={{
            background: "var(--color-mist)",
            border: "1px solid var(--color-fog)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "32px",
            textAlign: "left",
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "16px",
              textTransform: "lowercase",
            }}
          >
            how to link your account:
          </h3>
          <ol
            style={{
              fontSize: "15px",
              lineHeight: 1.8,
              paddingLeft: "20px",
              margin: 0,
            }}
          >
            <li>
              Open Discord and find the <strong>scrobbler bot</strong>
            </li>
            <li>
              Use the{" "}
              <code
                style={{
                  background: "rgba(0,0,0,0.1)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                }}
              >
                /link
              </code>{" "}
              command
            </li>
            <li>
              Follow the bot's instructions to connect your Last.fm account
            </li>
            <li>Come back here and refresh the page</li>
          </ol>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="https://scrobbler.netlify.app/invite"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            invite bot to discord →
          </a>
          <button
            onClick={() => window.location.reload()}
            className="btn"
            style={{
              background: "transparent",
              border: "1px solid var(--color-fog)",
            }}
          >
            ↻ refresh page
          </button>
        </div>

        <p
          style={{
            fontSize: "14px",
            opacity: 0.5,
            marginTop: "32px",
          }}
        >
          or{" "}
          <a href="/" style={{ textDecoration: "underline" }}>
            go back home
          </a>
        </p>
      </div>
    </div>
  );
}

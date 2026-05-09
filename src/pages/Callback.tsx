import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setError("No authorization code received");
      return;
    }

    // Exchange code for session
    fetch(`/api/auth-discord?code=${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.hasLastfm) {
            // Redirect to their dashboard
            navigate(`/user/${data.lastfmUsername}`);
          } else {
            // Redirect to "not linked" page
            navigate("/link-required");
          }
        } else {
          setError(data.error || "Authentication failed");
        }
      })
      .catch((err) => {
        console.error("Auth error:", err);
        setError("Failed to authenticate");
      });
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
      }}
    >
      {error ? (
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "48px",
              marginBottom: "16px",
              color: "var(--color-charcoal)",
            }}
          >
            authentication failed
          </h1>
          <p
            style={{
              fontSize: "18px",
              opacity: 0.7,
              marginBottom: "32px",
            }}
          >
            {error}
          </p>
          <a href="/" className="btn">
            ← back to home
          </a>
        </div>
      ) : (
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "48px",
              marginBottom: "16px",
              color: "var(--color-charcoal)",
            }}
          >
            authenticating...
          </h1>
          <p style={{ fontSize: "18px", opacity: 0.7 }}>
            please wait while we log you in
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { username } = useParams<{ username: string }>();
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [allowedUsername, setAllowedUsername] = useState<string | null>(null);

  useEffect(() => {
    // Check for dev bypass
    const devBypass = import.meta.env.VITE_DEV_BYPASS_USER;
    if (devBypass) {
      setAllowedUsername(devBypass);
      setAuthState("authenticated");
      return;
    }

    // Check authentication with backend
    fetch("/api/auth-check", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.lastfmUsername) {
          setAllowedUsername(data.lastfmUsername);
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
        }
      })
      .catch(() => {
        setAuthState("unauthenticated");
      });
  }, []);

  if (authState === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  // Check if user is trying to access their own dashboard
  if (username && allowedUsername && username.toLowerCase() !== allowedUsername.toLowerCase()) {
    return <Navigate to={`/user/${allowedUsername}`} replace />;
  }

  return <>{children}</>;
}

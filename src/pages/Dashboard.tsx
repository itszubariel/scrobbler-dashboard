import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserInfo } from "../lib/lastfm";
import Overview from "../components/Overview";
import Charts from "../components/Charts";
import RecentTracks from "../components/RecentTracks";
import Taste from "../components/Taste";
import Wrapped from "../components/Wrapped";
import Discover from "../components/Discover";
import Insights from "../components/Insights";

const NAV_ITEMS = [
  { id: "overview", label: "overview", icon: "◆" },
  { id: "charts", label: "charts", icon: "◈" },
  { id: "recent", label: "recent", icon: "◷" },
  { id: "taste", label: "taste", icon: "◉" },
  { id: "wrapped", label: "wrapped", icon: "✦" },
  { id: "discover", label: "discover", icon: "◇" },
  { id: "insights", label: "insights", icon: "◐" },
];

export default function Dashboard() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<any>(null);
  const [section, setSection] = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    getUserInfo(username).then((data) => setUser(data.user));
  }, [username]);

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

  if (!username) return null;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-wordmark">scrobbler</h1>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-link ${section === item.id ? "active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-bot-links">
            <a
              href="https://scrobbler.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-bot-link"
            >
              ✦ check out the bot
            </a>
            <a
              href="https://scrobbler.netlify.app/invite"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-bot-link"
            >
              → invite to discord
            </a>
          </div>

          <button
            className="sidebar-theme-toggle"
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

          {user && (
            <div className="sidebar-profile-wrapper">
              <button
                className="sidebar-profile-btn"
                onClick={() => setProfileOpen((o) => !o)}
              >
                <img
                  src={user.image?.[1]?.["#text"]}
                  alt={user.name}
                  className="sidebar-profile-avatar"
                />
                <div className="sidebar-profile-info">
                  <span className="sidebar-profile-name">{user.name}</span>
                  <span className="sidebar-profile-scrobbles">
                    {Number(user.playcount).toLocaleString()} scrobbles
                  </span>
                </div>
              </button>
              {profileOpen && (
                <div className="sidebar-profile-dropdown">
                  <img
                    src={user.image?.[2]?.["#text"]}
                    alt={user.name}
                    className="profile-dropdown-avatar"
                  />
                  <p className="profile-dropdown-name">{user.name}</p>
                  <p className="profile-dropdown-scrobbles">
                    {Number(user.playcount).toLocaleString()} scrobbles
                  </p>
                  {user.country && (
                    <p className="profile-dropdown-meta">{user.country}</p>
                  )}
                  <p className="profile-dropdown-meta">
                    since{" "}
                    {new Date(
                      Number(user.registered?.unixtime) * 1000,
                    ).getFullYear()}
                  </p>
                  <a
                    href={user.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-dropdown-link"
                  >
                    view on last.fm →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="dashboard-content-area">
        {section === "overview" && <Overview username={username} />}
        {section === "charts" && <Charts username={username} />}
        {section === "recent" && <RecentTracks username={username} />}
        {section === "taste" && <Taste username={username} />}
        {section === "wrapped" && <Wrapped username={username} />}
        {section === "discover" && <Discover username={username} />}
        {section === "insights" && <Insights username={username} />}
      </main>
    </div>
  );
}

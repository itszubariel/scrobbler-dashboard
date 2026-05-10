import { useEffect, useState } from "react";
import { getRecentTracks } from "../lib/lastfm";
import { getMemoryCache, setMemoryCache } from "../lib/cache";
import { SkeletonRecent } from "./SkeletonLoader";
import { useModal } from "../context/ModalContext";

interface Props {
  username: string;
}

const TOTAL_PAGES = 5;
const PAGE_SIZE = 20;

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

export default function RecentTracks({ username }: Props) {
  const { openModal } = useModal();
  const [currentPage, setCurrentPage] = useState(1);
  // pages maps page number -> fetched tracks array
  const [pages, setPages] = useState<Record<number, any[]>>(() => {
    const cached = getMemoryCache<any[]>(`recent-page-1-${username}`);
    return cached ? { 1: cached } : ({} as Record<number, any[]>);
  });
  const [loadingPage, setLoadingPage] = useState<number | null>(
    pages[1] ? null : 1,
  );

  // Fetch a page if not already cached in memory
  useEffect(() => {
    const cacheKey = `recent-page-${currentPage}-${username}`;

    // Already have it in state
    if (pages[currentPage]) return;

    // Check memory cache
    const cached = getMemoryCache<any[]>(cacheKey);
    if (cached) {
      setPages((prev) => ({ ...prev, [currentPage]: cached }));
      return;
    }

    // Fetch from API
    setLoadingPage(currentPage);
    getRecentTracks(username, String(PAGE_SIZE), String(currentPage)).then(
      (data) => {
        const tracks: any[] = data.recenttracks?.track || [];
        setMemoryCache(cacheKey, tracks);
        setPages((prev) => ({ ...prev, [currentPage]: tracks }));
        setLoadingPage(null);
      },
    );
  }, [username, currentPage]);

  // Header always comes from page 1's first track
  const page1Tracks = pages[1] ?? [];
  const headerTrack = page1Tracks[0] ?? null;
  const isNowPlaying = headerTrack?.["@attr"]?.nowplaying === "true";
  const headerImage =
    headerTrack?.image?.[3]?.["#text"] || headerTrack?.image?.[2]?.["#text"];

  // Current page's list (skip the now-playing entry on page 1 since it's in the header)
  const currentTracks = pages[currentPage] ?? [];
  const listTracks = currentPage === 1 ? currentTracks.slice(1) : currentTracks;

  // Unique artists across all fetched pages
  const uniqueArtists = new Set(
    Object.values(pages)
      .flat()
      .map((t: any) => t.artist?.["#text"])
      .filter(Boolean),
  ).size;

  const isLoading = loadingPage === currentPage;

  // Show full skeleton only on the very first load
  if (isLoading && !pages[1]) return <SkeletonRecent />;

  return (
    <div className="recent-section">
      <div className="section-header">
        <h2 className="section-title">recent tracks</h2>
        <p className="section-subtitle">
          your listening history, track by track
        </p>
      </div>

      {/* Header Track - Now Playing or Last Played (always page 1 first track) */}
      {headerTrack && (
        <div className="recent-header-card">
          {headerImage ? (
            <img
              src={headerImage}
              alt={headerTrack.name}
              className="recent-header-art"
            />
          ) : (
            <div className="recent-header-placeholder">
              {headerTrack.name?.charAt(0) || "—"}
            </div>
          )}
          <div className="recent-header-content">
            <div className="recent-header-label">
              {isNowPlaying ? "▶ now playing" : "◷ last played"}
            </div>
            <div className="recent-header-title">
              <button
                className="recent-header-name"
                onClick={() =>
                  openModal(
                    "track",
                    headerTrack.name,
                    headerTrack.artist?.["#text"],
                  )
                }
              >
                {headerTrack.name}
              </button>
            </div>
            <div
              className="recent-header-artist"
              style={{ cursor: "pointer" }}
              onClick={() =>
                openModal("artist", headerTrack.artist?.["#text"] || "")
              }
            >
              {headerTrack.artist?.["#text"]}
            </div>
            {headerTrack.album?.["#text"] && (
              <div className="recent-header-album">
                {headerTrack.album["#text"]}
              </div>
            )}
          </div>
          {isNowPlaying && <div className="recent-header-pulse" />}
        </div>
      )}

      {/* Track List */}
      {isLoading ? (
        <div className="recent-list">
          {Array.from({ length: PAGE_SIZE - (currentPage === 1 ? 1 : 0) }).map(
            (_, i) => (
              <div key={i} className="recent-list-row">
                <div
                  className="skeleton-image"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "4px",
                    flexShrink: 0,
                  }}
                />
                <div className="recent-list-info">
                  <div
                    className="skeleton-text"
                    style={{ width: "60%", height: "14px" }}
                  />
                  <div
                    className="skeleton-text"
                    style={{ width: "40%", height: "12px", marginTop: "6px" }}
                  />
                </div>
                <div
                  className="skeleton-text"
                  style={{ width: "40px", height: "12px" }}
                />
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="recent-list">
          {listTracks.map((t: any, i: number) => {
            const img = t.image?.[1]?.["#text"];
            const timeAgo = t.date?.uts ? formatTimeAgo(t.date.uts) : "?";

            return (
              <div key={i} className="recent-list-row">
                {img && (
                  <img src={img} alt={t.name} className="recent-list-art" />
                )}
                <div className="recent-list-info">
                  <button
                    className="recent-list-title"
                    onClick={() =>
                      openModal("track", t.name, t.artist?.["#text"])
                    }
                  >
                    {t.name}
                  </button>
                  <p
                    className="recent-list-artist"
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      openModal("artist", t.artist?.["#text"] || "")
                    }
                  >
                    {t.artist?.["#text"]}
                  </p>
                </div>
                <p className="recent-list-time">{timeAgo}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="wrapped-nav" style={{ marginTop: "16px" }}>
        <button
          className="wrapped-nav-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          ← previous
        </button>
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            padding: "0 8px",
          }}
        >
          page {currentPage} of {TOTAL_PAGES}
        </span>
        <button
          className="wrapped-nav-btn"
          onClick={() => setCurrentPage((p) => Math.min(TOTAL_PAGES, p + 1))}
          disabled={currentPage === TOTAL_PAGES}
        >
          next →
        </button>
      </div>

      {/* Footer */}
      <div className="page-based-on">
        up to 100 scrobbles • {uniqueArtists} unique artists • page{" "}
        {currentPage} of {TOTAL_PAGES}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getRecentTracks } from "../lib/lastfm";
import { getMemoryCache, setMemoryCache } from "../lib/cache";
import { SkeletonRecent } from "./SkeletonLoader";

interface Props {
  username: string;
}

export default function RecentTracks({ username }: Props) {
  // Tier 1: Memory-only cache - check memory on mount
  const [allTracks, setAllTracks] = useState<any[]>(() => {
    const cached = getMemoryCache<any[]>(`recent-tracks-${username}`);
    return cached || [];
  });
  const [uniqueArtists, setUniqueArtists] = useState(() => {
    const cached = getMemoryCache<number>(`recent-artists-count-${username}`);
    return cached || 0;
  });
  const [loading, setLoading] = useState(allTracks.length === 0);

  useEffect(() => {
    // If we have data in memory, don't fetch again
    if (allTracks.length > 0) return;

    setLoading(true);
    getRecentTracks(username, "50").then((data) => {
      const tracks = data.recenttracks?.track || [];
      setAllTracks(tracks);
      setMemoryCache(`recent-tracks-${username}`, tracks);

      // Calculate unique artists
      const artists = new Set(
        tracks.map((t: any) => t.artist?.["#text"]).filter(Boolean),
      );
      const count = artists.size;
      setUniqueArtists(count);
      setMemoryCache(`recent-artists-count-${username}`, count);

      setLoading(false);
    });
  }, [username]);

  if (loading && allTracks.length === 0) {
    return <SkeletonRecent />;
  }

  // First track is the header (now playing or last played)
  const headerTrack = allTracks[0];
  const isNowPlaying = headerTrack?.["@attr"]?.nowplaying === "true";
  const headerImage =
    headerTrack?.image?.[3]?.["#text"] || headerTrack?.image?.[2]?.["#text"];

  // Remaining tracks (all 49)
  const listTracks = allTracks.slice(1);

  // Format timestamp as relative time
  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  return (
    <div className="recent-section">
      <div className="section-header">
        <h2 className="section-title">recent tracks</h2>
        <p className="section-subtitle">
          your listening history, track by track
        </p>
      </div>

      {/* Header Track - Now Playing or Last Played */}
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
            <a
              href={headerTrack.url}
              target="_blank"
              rel="noopener noreferrer"
              className="recent-header-name"
            >
              {headerTrack.name}
            </a>
          </div>
          <div className="recent-header-artist">
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

      {/* Track List - Taste-style cards */}
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
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recent-list-title"
                >
                  {t.name}
                </a>
                <p className="recent-list-artist">{t.artist?.["#text"]}</p>
              </div>
              <p className="recent-list-time">{timeAgo}</p>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="page-based-on">
        {allTracks.length} scrobbles • {uniqueArtists} unique artists • based on
        last 50 scrobbles
      </div>
    </div>
  );
}

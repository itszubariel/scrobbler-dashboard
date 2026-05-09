import { useEffect, useState } from "react";
import { getRecentTracks } from "../lib/lastfm";
import { getMemoryCache, setMemoryCache } from "../lib/cache";

interface Props {
  username: string;
}

export default function NowPlaying({ username }: Props) {
  // Tier 1: Memory-only cache
  const [track, setTrack] = useState<any>(() => {
    const cached = getMemoryCache<any>(`now-playing-${username}`);
    return cached || null;
  });
  const [isLive, setIsLive] = useState(() => {
    const cached = getMemoryCache<boolean>(`now-playing-live-${username}`);
    return cached || false;
  });

  useEffect(() => {
    // If we have data in memory, don't fetch again
    if (track) return;

    getRecentTracks(username, "1").then((data) => {
      const t = data.recenttracks?.track?.[0];
      if (t) {
        setTrack(t);
        setMemoryCache(`now-playing-${username}`, t);

        const live = t["@attr"]?.nowplaying === "true";
        setIsLive(live);
        setMemoryCache(`now-playing-live-${username}`, live);
      }
    });
  }, [username]);

  if (!track) return null;

  const image = track.image?.[3]?.["#text"] || track.image?.[2]?.["#text"];
  const title = track.name;
  const artist = track.artist?.["#text"];
  const album = track.album?.["#text"];

  return (
    <div className="recent-header-card">
      {image ? (
        <img src={image} alt={title} className="recent-header-art" />
      ) : (
        <div className="recent-header-placeholder">
          {title?.charAt(0) || "—"}
        </div>
      )}
      <div className="recent-header-content">
        <div className="recent-header-label">
          {isLive ? "▶ now playing" : "◷ last played"}
        </div>
        <div className="recent-header-title">
          <a
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            className="recent-header-name"
          >
            {title}
          </a>
        </div>
        <div className="recent-header-artist">{artist}</div>
        {album && <div className="recent-header-album">{album}</div>}
      </div>
      {isLive && <div className="recent-header-pulse" />}
    </div>
  );
}

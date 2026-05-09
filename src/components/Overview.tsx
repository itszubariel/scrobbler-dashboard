import { useEffect, useState } from "react";
import { getUserInfo, getTopArtists, getTopTracks } from "../lib/lastfm";
import {
  cachedFetch,
  getCachedDataSync,
  getMemoryCache,
  setMemoryCache,
  CACHE_TTL,
} from "../lib/cache";
import NowPlaying from "./NowPlaying";
import { SkeletonOverview } from "./SkeletonLoader";

interface Props {
  username: string;
}

async function fetchArtistImage(artistName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/deezer-image?artist=${encodeURIComponent(artistName)}`,
    );
    const data = await res.json();
    return data.imageUrl || null;
  } catch {
    return null;
  }
}

async function fetchTrackImage(
  trackName: string,
  artistName: string,
): Promise<string | null> {
  try {
    const query = `${artistName} ${trackName}`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
    );
    const data = await res.json();
    if (data.results?.[0]?.artworkUrl100) {
      return data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
    }
    return null;
  } catch {
    return null;
  }
}

export default function Overview({ username }: Props) {
  // Tier 2: Persistent cache for user profile
  const [user, setUser] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`overview-user-${username}`);
    return cached?.user || null;
  });

  // Tier 1: Memory-only for scrobble count (updates frequently)
  const [scrobbleCount, setScrobbleCount] = useState(() => {
    const memoryCached = getMemoryCache<number>(`scrobble-count-${username}`);
    if (memoryCached) return memoryCached;

    // Fallback to user data from localStorage
    const userCached = getCachedDataSync<any>(`overview-user-${username}`);
    return userCached?.user?.playcount ? Number(userCached.user.playcount) : 0;
  });

  // Tier 2: Persistent cache for top artist
  const [topArtist, setTopArtist] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`overview-top-artist-${username}`);
    return cached || null;
  });

  // Tier 2: Persistent cache for top track
  const [topTrack, setTopTrack] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`overview-top-track-${username}`);
    return cached || null;
  });

  // Tier 2: Persistent cache for AI bio
  const [bio, setBio] = useState<string>(() => {
    const cached = getCachedDataSync<string>(`bio-${username}`);
    return cached || "";
  });

  useEffect(() => {
    // Fetch user info
    cachedFetch(
      `overview-user-${username}`,
      () => getUserInfo(username),
      CACHE_TTL.TOP_ARTISTS,
    ).then((data) => {
      const userData = data.user;
      if (JSON.stringify(userData) !== JSON.stringify(user)) {
        setUser(userData);
        // Update scrobble count in memory
        const count = Number(userData.playcount);
        setScrobbleCount(count);
        setMemoryCache(`scrobble-count-${username}`, count);
      }
    });

    // Fetch top artist with image
    cachedFetch(
      `overview-top-artist-${username}`,
      async () => {
        const data = await getTopArtists(username, "overall", "1");
        const artist = data.topartists?.artist?.[0];
        if (artist) {
          const image = await fetchArtistImage(artist.name);
          return { ...artist, image };
        }
        return null;
      },
      CACHE_TTL.TOP_ARTISTS,
    ).then((data) => {
      if (JSON.stringify(data) !== JSON.stringify(topArtist)) {
        setTopArtist(data);
      }
    });

    // Fetch top track with image
    cachedFetch(
      `overview-top-track-${username}`,
      async () => {
        const data = await getTopTracks(username, "overall", "1");
        const track = data.toptracks?.track?.[0];
        if (track) {
          const image = await fetchTrackImage(
            track.name,
            track.artist?.name || "",
          );
          return { ...track, image };
        }
        return null;
      },
      CACHE_TTL.TOP_TRACKS,
    ).then((data) => {
      if (JSON.stringify(data) !== JSON.stringify(topTrack)) {
        setTopTrack(data);
      }
    });

    // Fetch AI bio
    cachedFetch(
      `bio-${username}`,
      async () => {
        try {
          // Get top 5 artists
          const artistsData = await getTopArtists(username, "overall", "5");
          const artists = artistsData.topartists?.artist || [];
          const topArtists = artists.map((a: any) => a.name).join(", ");

          // Get top 3 genres from those artists
          const tagCounts: Record<string, number> = {};
          await Promise.all(
            artists.map(async (a: any) => {
              try {
                const res = await fetch(
                  `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&artist=${encodeURIComponent(a.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json`,
                );
                const d = await res.json();
                const tags = d.toptags?.tag?.slice(0, 3) || [];
                tags.forEach((t: any) => {
                  const name = t.name.toLowerCase();
                  tagCounts[name] = (tagCounts[name] || 0) + 1;
                });
              } catch {}
            }),
          );
          const topGenres = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name)
            .join(", ");

          // Get total scrobbles
          const userInfo = await getUserInfo(username);
          const totalScrobbles = userInfo.user.playcount;

          // Generate bio
          const res = await fetch(
            `/api/generate-bio?topArtists=${encodeURIComponent(topArtists)}&topGenres=${encodeURIComponent(topGenres)}&totalScrobbles=${totalScrobbles}`,
          );
          const bioData = await res.json();
          return bioData.bio || "";
        } catch {
          return "";
        }
      },
      6 * 60 * 60 * 1000, // 6 hours
    ).then((bioText) => {
      if (bioText !== bio) {
        setBio(bioText);
      }
    });
  }, [username]);

  if (!user && !topArtist && !topTrack) return <SkeletonOverview />;

  return (
    <div className="overview-page">
      <div className="overview-banner">
        <img
          src={user?.image?.[3]?.["#text"] || user?.image?.[2]?.["#text"]}
          alt={user?.name}
          className="overview-banner-avatar"
        />
        <div className="overview-banner-info">
          <h1 className="overview-banner-name">{user?.name}</h1>
          <p className="overview-banner-scrobbles">
            {scrobbleCount.toLocaleString()} scrobbles
          </p>
          {bio && (
            <>
              <p
                style={{
                  fontStyle: "italic",
                  marginTop: "12px",
                  lineHeight: "1.6",
                }}
              >
                {bio}
              </p>
              <p style={{ fontSize: "11px", opacity: 0.5, marginTop: "6px" }}>
                ✦ ai generated
              </p>
            </>
          )}
          {!bio && (
            <div className="overview-banner-meta">
              {user?.country && <span>{user.country}</span>}
              <span>
                member since{" "}
                {new Date(
                  Number(user?.registered?.unixtime) * 1000,
                ).getFullYear()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="overview-stats-row">
        <div className="overview-stat-card-large">
          {topArtist?.image ? (
            <img
              src={topArtist.image}
              alt={topArtist.name}
              className="overview-stat-card-img"
            />
          ) : (
            <div className="overview-stat-card-placeholder">
              {topArtist?.name?.charAt(0) || "—"}
            </div>
          )}
          <div className="overview-stat-card-content">
            <p className="overview-stat-card-label">top artist</p>
            {topArtist?.url ? (
              <a
                href={topArtist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="overview-stat-card-title overview-stat-card-link"
              >
                {topArtist.name}
              </a>
            ) : (
              <p className="overview-stat-card-title">
                {topArtist?.name || "—"}
              </p>
            )}
            {topArtist && (
              <p className="overview-stat-card-subtitle">
                {Number(topArtist.playcount).toLocaleString()} plays
              </p>
            )}
          </div>
        </div>

        <div className="overview-stat-card-large">
          {topTrack?.image ? (
            <img
              src={topTrack.image}
              alt={topTrack.name}
              className="overview-stat-card-img"
            />
          ) : (
            <div className="overview-stat-card-placeholder">
              {topTrack?.name?.charAt(0) || "—"}
            </div>
          )}
          <div className="overview-stat-card-content">
            <p className="overview-stat-card-label">top track</p>
            {topTrack?.url ? (
              <a
                href={topTrack.url}
                target="_blank"
                rel="noopener noreferrer"
                className="overview-stat-card-title overview-stat-card-link"
              >
                {topTrack.name}
              </a>
            ) : (
              <p className="overview-stat-card-title">
                {topTrack?.name || "—"}
              </p>
            )}
            {topTrack && (
              <p className="overview-stat-card-subtitle">
                {Number(topTrack.playcount).toLocaleString()} plays
              </p>
            )}
          </div>
        </div>

        <div className="overview-stat-card-large overview-stat-card-simple">
          <p className="overview-stat-card-label">total scrobbles</p>
          <p className="overview-stat-card-number">
            {scrobbleCount.toLocaleString()}
          </p>
        </div>

        <div className="overview-stat-card-large overview-stat-card-simple">
          <p className="overview-stat-card-label">member since</p>
          <p className="overview-stat-card-number">
            {new Date(Number(user?.registered?.unixtime) * 1000).getFullYear()}
          </p>
        </div>
      </div>

      <NowPlaying username={username} />
    </div>
  );
}

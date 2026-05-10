import { useEffect, useState } from "react";
import {
  getUserInfo,
  getTopArtists,
  getTopTracks,
  getRecentTracks,
} from "../lib/lastfm";
import {
  cachedFetch,
  getCachedDataSync,
  getMemoryCache,
  setMemoryCache,
  CACHE_TTL,
} from "../lib/cache";
import { SkeletonOverview } from "./SkeletonLoader";
import { useModal } from "../context/ModalContext";

interface Props {
  username: string;
}

interface OverviewData {
  user: any;
  topArtist: any;
  topTrack: any;
  bio: string;
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
  const { openModal } = useModal();
  const [overviewData, setOverviewData] = useState<OverviewData | null>(
    () => getCachedDataSync<OverviewData>(`overview-all-${username}`) || null,
  );

  const [nowPlaying, setNowPlaying] = useState<any>(
    () => getMemoryCache<any>(`now-playing-${username}`) || null,
  );
  const [nowPlayingLoading, setNowPlayingLoading] = useState(
    () => getMemoryCache<any>(`now-playing-${username}`) === null,
  );

  useEffect(() => {
    const cachedOverview = cachedFetch<OverviewData>(
      `overview-all-${username}`,
      async () => {
        const [userRes, artistsRes, tracksRes] = await Promise.all([
          getUserInfo(username),
          getTopArtists(username, "overall", "5"),
          getTopTracks(username, "overall", "1"),
        ]);

        const user = userRes.user;
        const artists = artistsRes.topartists?.artist || [];
        const rawTrack = tracksRes.toptracks?.track?.[0] || null;

        // Fetch top artist image + top track image in parallel
        const topArtistRaw = artists[0] || null;
        const [artistImage, trackImage] = await Promise.all([
          topArtistRaw
            ? fetchArtistImage(topArtistRaw.name)
            : Promise.resolve(null),
          rawTrack
            ? fetchTrackImage(rawTrack.name, rawTrack.artist?.name || "")
            : Promise.resolve(null),
        ]);

        const topArtist = topArtistRaw
          ? { ...topArtistRaw, image: artistImage }
          : null;
        const topTrack = rawTrack ? { ...rawTrack, image: trackImage } : null;

        // Fetch AI bio (uses top 5 artists already fetched)
        let bio = "";
        try {
          const topArtistNames = artists.map((a: any) => a.name).join(", ");

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

          const bioRes = await fetch(
            `/api/generate-bio?topArtists=${encodeURIComponent(topArtistNames)}&topGenres=${encodeURIComponent(topGenres)}&totalScrobbles=${user.playcount}`,
          );
          const bioData = await bioRes.json();
          bio = bioData.bio || "";
        } catch {}

        return { user, topArtist, topTrack, bio };
      },
      CACHE_TTL.TOP_ARTISTS, // 2 hours
    );

    const cachedNowPlaying = getMemoryCache<any>(`now-playing-${username}`)
      ? Promise.resolve(getMemoryCache<any>(`now-playing-${username}`))
      : getRecentTracks(username, "1").then((data) => {
          const t = data.recenttracks?.track?.[0] || null;
          if (t) setMemoryCache(`now-playing-${username}`, t);
          setNowPlayingLoading(false);
          return t;
        });

    Promise.all([cachedOverview, cachedNowPlaying]).then(([overview, np]) => {
      setOverviewData(overview);
      if (np) setNowPlaying(np);
      setNowPlayingLoading(false);
    });
  }, [username]);

  if (!overviewData) return <SkeletonOverview />;

  const { user, topArtist, topTrack, bio } = overviewData;
  const scrobbleCount = Number(user?.playcount) || 0;

  const npIsLive = nowPlaying?.["@attr"]?.nowplaying === "true";
  const npImage =
    nowPlaying?.image?.[3]?.["#text"] || nowPlaying?.image?.[2]?.["#text"];

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
          {bio ? (
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
          ) : (
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
            <button
              className="overview-stat-card-title overview-stat-card-link"
              onClick={() => topArtist && openModal("artist", topArtist.name)}
            >
              {topArtist?.name || "—"}
            </button>
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
            <button
              className="overview-stat-card-title overview-stat-card-link"
              onClick={() =>
                topTrack &&
                openModal("track", topTrack.name, topTrack.artist?.name)
              }
            >
              {topTrack?.name || "—"}
            </button>
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

      {nowPlayingLoading ? (
        <div className="recent-header-card">
          <div
            className="skeleton-image"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "8px",
              flexShrink: 0,
            }}
          />
          <div className="recent-header-content">
            <div
              className="skeleton-text"
              style={{ width: "80px", height: "12px", marginBottom: "10px" }}
            />
            <div
              className="skeleton-text"
              style={{ width: "200px", height: "16px", marginBottom: "8px" }}
            />
            <div
              className="skeleton-text"
              style={{ width: "140px", height: "13px" }}
            />
          </div>
        </div>
      ) : nowPlaying ? (
        <div className="recent-header-card">
          {npImage ? (
            <img
              src={npImage}
              alt={nowPlaying.name}
              className="recent-header-art"
            />
          ) : (
            <div className="recent-header-placeholder">
              {nowPlaying.name?.charAt(0) || "—"}
            </div>
          )}
          <div className="recent-header-content">
            <div className="recent-header-label">
              {npIsLive ? "▶ now playing" : "◷ last played"}
            </div>
            <div className="recent-header-title">
              <button
                className="recent-header-name"
                onClick={() =>
                  openModal(
                    "track",
                    nowPlaying.name,
                    nowPlaying.artist?.["#text"],
                  )
                }
              >
                {nowPlaying.name}
              </button>
            </div>
            <div className="recent-header-artist">
              {nowPlaying.artist?.["#text"]}
            </div>
            {nowPlaying.album?.["#text"] && (
              <div className="recent-header-album">
                {nowPlaying.album["#text"]}
              </div>
            )}
          </div>
          {npIsLive && <div className="recent-header-pulse" />}
        </div>
      ) : null}
    </div>
  );
}

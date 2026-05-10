import { useEffect, useState } from "react";
import { getTopArtists, getTopTracks, getTopAlbums } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";
import { SkeletonDiscover } from "./SkeletonLoader";
import { useModal } from "../context/ModalContext";
import type { ModalType } from "../context/ModalContext";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

interface Props {
  username: string;
}

const PERIODS = [
  { label: "7 days", value: "7day" },
  { label: "1 month", value: "1month" },
  { label: "3 months", value: "3month" },
  { label: "6 months", value: "6month" },
  { label: "12 months", value: "12month" },
  { label: "all time", value: "overall" },
];

const TABS = [
  { label: "artists", value: "artists" },
  { label: "tracks", value: "tracks" },
  { label: "albums", value: "albums" },
];

async function fetchArtistImage(artistName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/deezer-image?artist=${encodeURIComponent(artistName)}`,
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
      return data.results[0].artworkUrl100.replace("100x100", "600x600");
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAlbumImage(
  albumName: string,
  artistName: string,
): Promise<string | null> {
  try {
    const query = `${artistName} ${albumName}`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`,
    );
    const data = await res.json();
    if (data.results?.[0]?.artworkUrl100) {
      return data.results[0].artworkUrl100.replace("100x100", "600x600");
    }
    return null;
  } catch {
    return null;
  }
}

export default function Discover({ username }: Props) {
  const { openModal } = useModal();
  const [period, setPeriod] = useState("overall");
  const [tab, setTab] = useState("artists");

  const isMobile = useIsMobile();
  const recCount = isMobile ? 10 : 9;

  useEffect(() => {
    // Bust old cache entries that don't include the count in their key
    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("scrobbler_cache_discover-rec-") &&
          !key.includes("-10-") &&
          !key.includes("-9-")
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  }, []);

  // Separate state for discovery score and recommendations
  const [discoveryData, setDiscoveryData] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`discover-score-overall-${username}`);
    return cached || null;
  });

  const [recommendations, setRecommendations] = useState<any>(() => {
    // Default to 9 for initial cache lookup; recCount effect will correct on mount
    const cached = getCachedDataSync<any>(
      `discover-rec-artists-overall-9-${username}`,
    );
    return cached || null;
  });

  const [loadingScore, setLoadingScore] = useState(discoveryData === null);
  const [loadingRec, setLoadingRec] = useState(recommendations === null);

  // Fetch discovery score when period changes
  useEffect(() => {
    const cacheKey = `discover-score-${period}-${username}`;
    const cachedData = getCachedDataSync<any>(cacheKey);

    if (cachedData) {
      setDiscoveryData(cachedData);
      setLoadingScore(false);
      return;
    }

    setLoadingScore(true);

    cachedFetch(
      cacheKey,
      async () => {
        const scoreData = await getTopArtists(username, period, "100");
        const allArtists = scoreData.topartists?.artist || [];

        const listenerData = await Promise.all(
          allArtists.map(async (a: any) => {
            try {
              const info = await cachedFetch(
                `artist-info-${a.name}`,
                async () => {
                  const res = await fetch(
                    `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(a.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json`,
                  );
                  return res.json();
                },
                CACHE_TTL.DISCOVERY,
              );
              const listeners = Number(info.artist?.stats?.listeners || 0);
              const playcount = Number(a.playcount) || 0;
              return { name: a.name, listeners, playcount };
            } catch {
              return { name: a.name, listeners: 0, playcount: 0 };
            }
          }),
        );

        const totalPlaycount = listenerData.reduce(
          (sum, { playcount }) => sum + playcount,
          0,
        );
        const weightedMainstream = listenerData.reduce(
          (sum, { listeners, playcount }) => {
            const mainstreamScore = Math.min(listeners / 5000000, 1) * 100;
            return sum + mainstreamScore * playcount;
          },
          0,
        );
        const mainstreamScore =
          totalPlaycount > 0 ? weightedMainstream / totalPlaycount : 0;
        const undergroundScore = Math.round(100 - mainstreamScore);

        let scoreLabel = "mainstream maven";
        if (undergroundScore > 80) scoreLabel = "underground pioneer";
        else if (undergroundScore > 60) scoreLabel = "indie explorer";
        else if (undergroundScore > 40) scoreLabel = "balanced listener";
        else if (undergroundScore > 20) scoreLabel = "chart familiar";

        const sorted = [...listenerData].sort(
          (a, b) => a.listeners - b.listeners,
        );

        return {
          discoveryScore: undergroundScore,
          label: scoreLabel,
          mostUnderground: sorted[0],
          mostMainstream: sorted[sorted.length - 1],
        };
      },
      CACHE_TTL.DISCOVERY,
    ).then((data) => {
      setDiscoveryData(data);
      setLoadingScore(false);
    });
  }, [username, period]);

  // Fetch recommendations when period or tab changes
  useEffect(() => {
    const cacheKey = `discover-rec-${tab}-${period}-${recCount}-${username}`;
    const cachedData = getCachedDataSync<any>(cacheKey);

    if (cachedData) {
      setRecommendations(cachedData);
      setLoadingRec(false);
      return;
    }

    setLoadingRec(true);

    cachedFetch(
      cacheKey,
      async () => {
        if (tab === "artists") {
          const topArtistsData = await getTopArtists(username, period, "50");
          const artists = topArtistsData.topartists?.artist || [];

          const topArtistNamesLower = artists.map((a: any) =>
            a.name.toLowerCase(),
          );
          const top10Artists = artists.slice(0, 10);

          const scoreMap = new Map<string, number>();
          const firstSeenMap = new Map<string, number>();
          const nameMap = new Map<string, string>(); // lowercase -> original casing
          let globalIndex = 0;

          // Process artists sequentially to maintain deterministic order
          for (const artist of top10Artists) {
            try {
              const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artist.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json&limit=20`,
              );
              const data = await res.json();
              const similar = data.similarartists?.artist || [];

              similar.forEach((s: any) => {
                const lower = s.name.toLowerCase();
                if (!topArtistNamesLower.includes(lower)) {
                  // Increment score
                  scoreMap.set(lower, (scoreMap.get(lower) ?? 0) + 1);

                  // Track first appearance order and original name
                  if (!firstSeenMap.has(lower)) {
                    firstSeenMap.set(lower, globalIndex);
                    nameMap.set(lower, s.name);
                    globalIndex++;
                  }
                }
              });
            } catch {}
          }

          // Build scored list from the maps
          const scored = Array.from(scoreMap.entries()).map(
            ([lowerName, score]) => ({
              name: nameMap.get(lowerName) || lowerName,
              score,
              firstSeen: firstSeenMap.get(lowerName) ?? 999,
            }),
          );

          scored.sort((a, b) => {
            // Primary: score descending
            if (b.score !== a.score) return b.score - a.score;
            // Tiebreaker: first seen order ascending (earlier is better)
            return a.firstSeen - b.firstSeen;
          });

          const topRecommended = scored.slice(0, recCount).map((s) => s.name);

          const withImages = await Promise.all(
            topRecommended.map(async (artistName: string) => {
              const image = await fetchArtistImage(artistName);
              return { name: artistName, image };
            }),
          );

          return withImages;
        } else if (tab === "tracks") {
          const topTracksData = await getTopTracks(username, period, "50");
          const tracks = topTracksData.toptracks?.track || [];

          const top50TrackKeys = new Set(
            tracks.map((t: any) =>
              `${t.name}|||${t.artist?.name || t.artist?.["#text"]}`.toLowerCase(),
            ),
          );
          const top10Tracks = tracks.slice(0, 10);
          const allSimilarTracks: any[] = [];

          await Promise.all(
            top10Tracks.map(async (track: any) => {
              try {
                const artistName =
                  track.artist?.name || track.artist?.["#text"] || "";
                const res = await fetch(
                  `https://ws.audioscrobbler.com/2.0/?method=track.getSimilar&track=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(artistName)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json&limit=20`,
                );
                const data = await res.json();
                const similar = data.similartracks?.track || [];
                similar.forEach((s: any) => {
                  const sArtist = s.artist?.name || s.artist?.["#text"] || "";
                  const key = `${s.name}|||${sArtist}`.toLowerCase();
                  if (!top50TrackKeys.has(key)) {
                    allSimilarTracks.push({ ...s, artist: sArtist });
                  }
                });
              } catch {}
            }),
          );

          const trackScoreMap = new Map<
            string,
            { track: any; count: number }
          >();
          allSimilarTracks.forEach((track) => {
            const key = `${track.name}|||${track.artist}`.toLowerCase();
            if (!trackScoreMap.has(key)) {
              trackScoreMap.set(key, { track, count: 0 });
            }
            trackScoreMap.get(key)!.count++;
          });

          const topRecommended = Array.from(trackScoreMap.values())
            .sort((a, b) => {
              // Primary: score descending
              if (b.count !== a.count) return b.count - a.count;
              // Tiebreaker: alphabetical by name
              return a.track.name.localeCompare(b.track.name);
            })
            .slice(0, recCount)
            .map(({ track }) => track);

          const withImages = await Promise.all(
            topRecommended.map(async (track: any) => {
              const image = await fetchTrackImage(track.name, track.artist);
              return { name: track.name, artist: track.artist, image };
            }),
          );

          return withImages;
        } else {
          // albums
          const topArtistsData = await getTopArtists(username, period, "50");
          const artists = topArtistsData.topartists?.artist || [];
          const topAlbumsData = await getTopAlbums(username, period, "50");
          const albums = topAlbumsData.topalbums?.album || [];

          const top50AlbumKeys = new Set(
            albums.map((a: any) =>
              `${a.name}|||${a.artist?.name || a.artist?.["#text"]}`.toLowerCase(),
            ),
          );
          const top10ForAlbums = artists.slice(0, 10);
          const allAlbums: any[] = [];

          await Promise.all(
            top10ForAlbums.map(async (artist: any, index: number) => {
              try {
                const res = await fetch(
                  `https://ws.audioscrobbler.com/2.0/?method=artist.getTopAlbums&artist=${encodeURIComponent(artist.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json&limit=10`,
                );
                const data = await res.json();
                const artistAlbums = data.topalbums?.album || [];
                artistAlbums.forEach((a: any) => {
                  const key = `${a.name}|||${artist.name}`.toLowerCase();
                  if (!top50AlbumKeys.has(key)) {
                    allAlbums.push({
                      name: a.name,
                      artist: artist.name,
                      score: 10 - index,
                    });
                  }
                });
              } catch {}
            }),
          );

          const topRecommended = allAlbums
            .sort((a, b) => {
              // Primary: score descending
              if (b.score !== a.score) return b.score - a.score;
              // Tiebreaker: alphabetical by name
              return a.name.localeCompare(b.name);
            })
            .slice(0, recCount);

          const withImages = await Promise.all(
            topRecommended.map(async (album: any) => {
              const image = await fetchAlbumImage(album.name, album.artist);
              return { name: album.name, artist: album.artist, image };
            }),
          );

          return withImages;
        }
      },
      CACHE_TTL.DISCOVERY,
    ).then((data) => {
      setRecommendations(data);
      setLoadingRec(false);
    });
  }, [username, period, tab, recCount]);

  // Show skeleton while loading initial data
  if (loadingScore && !discoveryData) return <SkeletonDiscover />;

  const discoveryScore = discoveryData?.discoveryScore || 0;
  const mainstreamScore = 100 - discoveryScore;

  return (
    <div className="discover-section">
      <div className="section-header">
        <h2 className="section-title">discover</h2>
        <p className="section-subtitle">
          your underground score and personalized recommendations
        </p>
      </div>

      {/* Period selector */}
      <div className="discover-controls">
        <div className="control-group">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={`control-btn ${period === p.value ? "active" : ""}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Discovery Score Card */}
      {loadingScore ? (
        <div className="discover-score-card">
          <div
            className="skeleton-text"
            style={{ width: "120px", height: "48px", margin: "0 auto 16px" }}
          />
          <div
            className="skeleton-text"
            style={{ width: "200px", height: "24px", margin: "0 auto 24px" }}
          />
        </div>
      ) : (
        <div className="discover-score-card">
          <p className="discover-score-value">{discoveryScore}%</p>
          <p className="discover-score-label">{discoveryData?.label}</p>

          <div className="discover-score-bars">
            <div className="discover-score-bar-row">
              <span className="discover-score-bar-label">underground</span>
              <div className="discover-score-bar-track">
                <div
                  className="discover-score-bar-fill discover-score-bar-underground"
                  style={{ width: `${discoveryScore}%` }}
                />
              </div>
              <span className="discover-score-bar-pct">{discoveryScore}%</span>
            </div>
            <div className="discover-score-bar-row">
              <span className="discover-score-bar-label">mainstream</span>
              <div className="discover-score-bar-track">
                <div
                  className="discover-score-bar-fill discover-score-bar-mainstream"
                  style={{ width: `${mainstreamScore}%` }}
                />
              </div>
              <span className="discover-score-bar-pct">{mainstreamScore}%</span>
            </div>
          </div>

          {discoveryData?.mostUnderground && discoveryData?.mostMainstream && (
            <div className="discover-score-extremes">
              <div className="discover-score-extreme">
                <p className="discover-score-extreme-label">most underground</p>
                <p className="discover-score-extreme-name">
                  {discoveryData.mostUnderground.name}
                </p>
                <p className="discover-score-extreme-count">
                  {discoveryData.mostUnderground.listeners.toLocaleString()}{" "}
                  listeners
                </p>
              </div>
              <div className="discover-score-extreme">
                <p className="discover-score-extreme-label">most mainstream</p>
                <p className="discover-score-extreme-name">
                  {discoveryData.mostMainstream.name}
                </p>
                <p className="discover-score-extreme-count">
                  {discoveryData.mostMainstream.listeners.toLocaleString()}{" "}
                  listeners
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Section */}
      <div className="discover-recommendations">
        <h3 className="discover-heading">recommendations</h3>

        <div className="discover-tabs">
          {TABS.map((t) => (
            <button
              key={t.value}
              className={`control-btn ${tab === t.value ? "active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loadingRec ? (
          <div
            className="discover-rec-grid"
            style={{
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
            }}
          >
            {Array.from({ length: recCount }).map((_, i) => (
              <div key={i} className="discover-rec-card">
                <div
                  className="skeleton-image"
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "8px",
                  }}
                />
                <div
                  className="skeleton-text"
                  style={{ width: "80%", height: "16px", marginTop: "8px" }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="discover-rec-grid"
            style={{
              gridTemplateColumns: isMobile
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
            }}
          >
            {recommendations?.map((item: any, i: number) => (
              <div key={i} className="discover-rec-card">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="discover-rec-img"
                    onError={() =>
                      console.error(
                        "[Discover] Image failed to load:",
                        item.image,
                      )
                    }
                  />
                ) : (
                  <div className="discover-rec-placeholder">
                    {item.name.charAt(0)}
                  </div>
                )}
                <div className="discover-rec-info">
                  <button
                    className="discover-rec-name"
                    onClick={() =>
                      openModal(
                        (tab === "artists"
                          ? "artist"
                          : tab === "tracks"
                            ? "track"
                            : "album") as ModalType,
                        item.name,
                        item.artist,
                      )
                    }
                  >
                    {item.name}
                  </button>
                  {item.artist && (
                    <p className="discover-rec-artist">{item.artist}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="page-based-on">
        based on top 50 {tab} • {PERIODS.find((p) => p.value === period)?.label}
      </div>
    </div>
  );
}

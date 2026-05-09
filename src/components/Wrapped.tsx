import { useEffect, useState, useRef } from "react";
import { getTopArtists, getTopTracks, getUserInfo } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";
import { SkeletonWrapped } from "./SkeletonLoader";

interface Props {
  username: string;
}

const PERIODS = [
  { label: "last 7 days", value: "7day", days: 7 },
  { label: "this month", value: "1month", days: 30 },
  { label: "last 3 months", value: "3month", days: 90 },
  { label: "last 6 months", value: "6month", days: 180 },
  { label: "last year", value: "12month", days: 365 },
  { label: "all time", value: "overall", days: 365 * 5 },
];

const BLOCKED_TAGS = [
  "seen live",
  "favorites",
  "favourite",
  "favorite",
  "owned",
];

function isYearTag(tag: string): boolean {
  return /^\d{4}$/.test(tag);
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

export default function Wrapped({ username }: Props) {
  const [period, setPeriod] = useState("overall");
  const [slide, setSlide] = useState(0);

  // Tier 2: Initialize from localStorage with stable cache key
  const [data, setData] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`wrapped-${period}-${username}`);
    return cached || null;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(data === null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlide(0); // Reset to first slide when period changes

    const cacheKey = `wrapped-${period}-${username}`;

    // Check cache for this period
    const cachedData = getCachedDataSync<any>(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    cachedFetch(
      cacheKey,
      async () => {
        // Fetch all raw data
        const [userRes, artistsRes, tracksRes] = await Promise.all([
          getUserInfo(username),
          getTopArtists(username, period, "10"),
          getTopTracks(username, period, "10"),
        ]);

        const user = userRes.user;
        const artists = artistsRes.topartists?.artist || [];
        const tracks = tracksRes.toptracks?.track || [];

        // Fetch images for top 5 artists
        const artistsWithImages = await Promise.all(
          artists.slice(0, 5).map(async (a: any) => ({
            ...a,
            image: await fetchArtistImage(a.name),
          })),
        );

        // Fetch images for top 5 tracks
        const tracksWithImages = await Promise.all(
          tracks.slice(0, 5).map(async (t: any) => ({
            ...t,
            image: await fetchTrackImage(t.name, t.artist?.name || ""),
          })),
        );

        // Calculate genres using weighted algorithm
        const artistNames = new Set(
          artists.map((a: any) => a.name.toLowerCase()),
        );
        const tagWeights: Record<string, number> = {};

        await Promise.all(
          artists.map(async (artist: any) => {
            const playcount = Number(artist.playcount) || 0;

            try {
              const tags = await cachedFetch(
                `artist-tags-${artist.name}`,
                async () => {
                  const res = await fetch(
                    `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&artist=${encodeURIComponent(artist.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json`,
                  );
                  const d = await res.json();
                  return d.toptags?.tag?.slice(0, 3) || [];
                },
                CACHE_TTL.TASTE,
              );

              tags.forEach((t: any) => {
                const tagName = t.name.toLowerCase();
                if (BLOCKED_TAGS.includes(tagName)) return;
                if (isYearTag(tagName)) return;
                if (artistNames.has(tagName)) return;
                tagWeights[tagName] = (tagWeights[tagName] || 0) + playcount;
              });
            } catch {}
          }),
        );

        const sortedTags = Object.entries(tagWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const totalWeight = sortedTags.reduce(
          (sum, [_, weight]) => sum + weight,
          0,
        );
        const topGenres = sortedTags.map(([name, weight]) => ({
          name,
          percentage:
            totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
        }));

        // Calculate discovery score
        const listenerCounts = await Promise.all(
          artists.map(async (a: any) => {
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
              return { listeners, playcount };
            } catch {
              return { listeners: 0, playcount: 0 };
            }
          }),
        );

        const totalPlaycount = listenerCounts.reduce(
          (sum, { playcount }) => sum + playcount,
          0,
        );
        const weightedMainstream = listenerCounts.reduce(
          (sum, { listeners, playcount }) => {
            const mainstream = Math.min(1, listeners / 5000000) * 100;
            return sum + mainstream * playcount;
          },
          0,
        );
        const mainstreamScore =
          totalPlaycount > 0 ? weightedMainstream / totalPlaycount : 0;
        const discoveryScore = Math.round(100 - mainstreamScore);

        // Calculate stats
        const periodDays = PERIODS.find((p) => p.value === period)?.days || 365;
        const dailyAvg = Math.round(Number(user.playcount) / periodDays);
        const artistCount = Number(user.artist_count) || 0;
        const trackCount = Number(user.track_count) || 0;
        const albumCount = Number(user.album_count) || 0;

        const periodLabel =
          PERIODS.find((p) => p.value === period)?.label || "all time";

        // Return fully processed data with images
        return {
          user,
          artists: artistsWithImages,
          allArtists: artists,
          tracks: tracksWithImages,
          topGenres,
          discoveryScore,
          dailyAvg,
          artistCount,
          trackCount,
          albumCount,
          periodLabel,
        };
      },
      CACHE_TTL.TOP_ARTISTS,
    ).then((processedData) => {
      if (JSON.stringify(processedData) !== JSON.stringify(data)) {
        setData(processedData);
      }
      setLoading(false);
    });
  }, [username, period]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setSlide((s) => Math.max(0, s - 1));
      } else if (e.key === "ArrowRight") {
        setSlide((s) => Math.min(4, s + 1));
      } else if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (loading && !data) return <SkeletonWrapped />;

  const maxGenrePercentage = data?.topGenres[0]?.percentage || 1;

  return (
    <div
      ref={containerRef}
      className={`wrapped-container ${isFullscreen ? "wrapped-fullscreen" : ""}`}
    >
      {!isFullscreen && (
        <>
          <div className="section-header">
            <h2 className="section-title">wrapped</h2>
            <p className="section-subtitle">
              your music year in review, spotify wrapped style
            </p>
          </div>

          <div className="wrapped-header">
            <div className="wrapped-controls">
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
            <button
              className="wrapped-fullscreen-btn"
              onClick={toggleFullscreen}
            >
              ⛶
            </button>
          </div>
        </>
      )}

      {isFullscreen && (
        <div className="wrapped-fullscreen-header">
          <button className="wrapped-fullscreen-btn" onClick={toggleFullscreen}>
            ✕
          </button>
        </div>
      )}

      <div className="wrapped-slides">
        <div
          className="wrapped-slide-track"
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          {/* SLIDE 1: COVER */}
          <div className="wrapped-slide wrapped-slide-cover">
            <div className="wrapped-slide-content">
              <p className="wrapped-slide-eyebrow">scrobbler wrapped</p>
              <h1 className="wrapped-slide-username">{data?.user.name}</h1>
              <p className="wrapped-slide-scrobbles">
                {Number(data?.user.playcount).toLocaleString()}
              </p>
              <p className="wrapped-slide-scrobbles-label">scrobbles</p>
              <p className="wrapped-slide-period">{data?.periodLabel}</p>
            </div>
          </div>

          {/* SLIDE 2: TOP ARTISTS PODIUM */}
          <div className="wrapped-slide wrapped-slide-artists">
            <div className="wrapped-slide-content">
              <h2 className="wrapped-slide-heading">top artists</h2>
              <div className="wrapped-podium">
                {/* #4 - Far Left */}
                {data?.artists[3] && (
                  <div className="wrapped-podium-item wrapped-podium-4">
                    <span className="wrapped-podium-rank">#4</span>
                    {data.artists[3].image ? (
                      <img
                        src={data.artists[3].image}
                        alt={data.artists[3].name}
                        className="wrapped-podium-img"
                      />
                    ) : (
                      <div className="wrapped-podium-placeholder">
                        {data.artists[3].name.charAt(0)}
                      </div>
                    )}
                    <p className="wrapped-podium-name">
                      {data.artists[3].name}
                    </p>
                    <p className="wrapped-podium-plays">
                      {Number(data.artists[3].playcount).toLocaleString()} plays
                    </p>
                  </div>
                )}

                {/* #2 - Left Center */}
                {data?.artists[1] && (
                  <div className="wrapped-podium-item wrapped-podium-2">
                    <span className="wrapped-podium-rank">#2</span>
                    {data.artists[1].image ? (
                      <img
                        src={data.artists[1].image}
                        alt={data.artists[1].name}
                        className="wrapped-podium-img"
                      />
                    ) : (
                      <div className="wrapped-podium-placeholder">
                        {data.artists[1].name.charAt(0)}
                      </div>
                    )}
                    <p className="wrapped-podium-name">
                      {data.artists[1].name}
                    </p>
                    <p className="wrapped-podium-plays">
                      {Number(data.artists[1].playcount).toLocaleString()} plays
                    </p>
                  </div>
                )}

                {/* #1 - Center (Winner) */}
                {data?.artists[0] && (
                  <div className="wrapped-podium-item wrapped-podium-1">
                    <span className="wrapped-podium-rank">#1</span>
                    {data.artists[0].image ? (
                      <img
                        src={data.artists[0].image}
                        alt={data.artists[0].name}
                        className="wrapped-podium-img"
                      />
                    ) : (
                      <div className="wrapped-podium-placeholder">
                        {data.artists[0].name.charAt(0)}
                      </div>
                    )}
                    <p className="wrapped-podium-name">
                      {data.artists[0].name}
                    </p>
                    <p className="wrapped-podium-plays">
                      {Number(data.artists[0].playcount).toLocaleString()} plays
                    </p>
                  </div>
                )}

                {/* #3 - Right Center */}
                {data?.artists[2] && (
                  <div className="wrapped-podium-item wrapped-podium-3">
                    <span className="wrapped-podium-rank">#3</span>
                    {data.artists[2].image ? (
                      <img
                        src={data.artists[2].image}
                        alt={data.artists[2].name}
                        className="wrapped-podium-img"
                      />
                    ) : (
                      <div className="wrapped-podium-placeholder">
                        {data.artists[2].name.charAt(0)}
                      </div>
                    )}
                    <p className="wrapped-podium-name">
                      {data.artists[2].name}
                    </p>
                    <p className="wrapped-podium-plays">
                      {Number(data.artists[2].playcount).toLocaleString()} plays
                    </p>
                  </div>
                )}

                {/* #5 - Far Right */}
                {data?.artists[4] && (
                  <div className="wrapped-podium-item wrapped-podium-5">
                    <span className="wrapped-podium-rank">#5</span>
                    {data.artists[4].image ? (
                      <img
                        src={data.artists[4].image}
                        alt={data.artists[4].name}
                        className="wrapped-podium-img"
                      />
                    ) : (
                      <div className="wrapped-podium-placeholder">
                        {data.artists[4].name.charAt(0)}
                      </div>
                    )}
                    <p className="wrapped-podium-name">
                      {data.artists[4].name}
                    </p>
                    <p className="wrapped-podium-plays">
                      {Number(data.artists[4].playcount).toLocaleString()} plays
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SLIDE 3: TOP TRACKS LIST */}
          <div className="wrapped-slide wrapped-slide-tracks">
            <div className="wrapped-slide-content">
              <h2 className="wrapped-slide-heading">top tracks</h2>
              <div className="wrapped-tracks-list">
                {data?.tracks.map((t: any, i: number) => (
                  <div key={i} className="wrapped-track-row">
                    <span className="wrapped-track-rank">{i + 1}</span>
                    {t.image ? (
                      <img
                        src={t.image}
                        alt={t.name}
                        className="wrapped-track-img"
                      />
                    ) : (
                      <div className="wrapped-track-placeholder">
                        {t.name.charAt(0)}
                      </div>
                    )}
                    <div className="wrapped-track-info">
                      <p className="wrapped-track-name">{t.name}</p>
                      <p className="wrapped-track-artist">{t.artist?.name}</p>
                    </div>
                    <p className="wrapped-track-plays">
                      {Number(t.playcount).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SLIDE 4: TASTE DNA */}
          <div className="wrapped-slide wrapped-slide-taste">
            <div className="wrapped-slide-content">
              <h2 className="wrapped-slide-heading">taste dna</h2>
              <div className="wrapped-taste-genres">
                {data?.topGenres.map((g: any, i: number) => (
                  <div key={i} className="wrapped-taste-genre">
                    <p className="wrapped-taste-genre-name">{g.name}</p>
                    <div className="wrapped-taste-genre-bar">
                      <div
                        className="wrapped-taste-genre-fill"
                        style={{
                          width: `${(g.percentage / maxGenrePercentage) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="wrapped-taste-genre-pct">{g.percentage}%</p>
                  </div>
                ))}
              </div>
              <div className="wrapped-taste-sound">
                <p className="wrapped-taste-sound-label">your sound</p>
                <p className="wrapped-taste-sound-value">
                  {data?.topGenres
                    .slice(0, 3)
                    .map((g: any) => g.name)
                    .join(" • ")}
                </p>
              </div>
              <div className="wrapped-taste-discovery">
                <div className="wrapped-taste-discovery-labels">
                  <span>underground</span>
                  <span>mainstream</span>
                </div>
                <div className="wrapped-taste-discovery-bar">
                  <div
                    className="wrapped-taste-discovery-fill"
                    style={{ width: `${data?.discoveryScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 5: BY THE NUMBERS */}
          <div className="wrapped-slide wrapped-slide-stats">
            <div className="wrapped-slide-content">
              <h2 className="wrapped-slide-heading">by the numbers</h2>
              <div className="wrapped-stats-grid">
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">
                    {data?.artistCount.toLocaleString()}
                  </p>
                  <p className="wrapped-stat-label">artists</p>
                </div>
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">
                    {data?.trackCount.toLocaleString()}
                  </p>
                  <p className="wrapped-stat-label">tracks</p>
                </div>
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">
                    {data?.albumCount.toLocaleString()}
                  </p>
                  <p className="wrapped-stat-label">albums</p>
                </div>
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">{data?.discoveryScore}%</p>
                  <p className="wrapped-stat-label">underground</p>
                </div>
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">
                    {data?.topGenres[0]?.name || "—"}
                  </p>
                  <p className="wrapped-stat-label">top genre</p>
                </div>
                <div className="wrapped-stat-box">
                  <p className="wrapped-stat-value">{data?.dailyAvg}</p>
                  <p className="wrapped-stat-label">daily avg</p>
                </div>
              </div>
              <p className="wrapped-stats-footer">made with scrobbler</p>
            </div>
          </div>
        </div>
      </div>

      <div className="wrapped-nav">
        <button
          className="wrapped-nav-btn"
          onClick={() => setSlide((s) => Math.max(0, s - 1))}
          disabled={slide === 0}
        >
          ← prev
        </button>
        <div className="wrapped-nav-dots">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`wrapped-nav-dot ${slide === i ? "active" : ""}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
        <button
          className="wrapped-nav-btn"
          onClick={() => setSlide((s) => Math.min(4, s + 1))}
          disabled={slide === 4}
        >
          next →
        </button>
      </div>

      {!isFullscreen && (
        <div className="page-based-on">
          based on {data?.periodLabel} • top artists, tracks, and genres
        </div>
      )}
    </div>
  );
}

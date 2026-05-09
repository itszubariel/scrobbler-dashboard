import { useEffect, useState } from "react";
import { getTopArtists, getTopTracks, getTopAlbums } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";
import { SkeletonDiscover } from "./SkeletonLoader";

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
  const [period, setPeriod] = useState("overall");
  const [tab, setTab] = useState("artists");

  // Tier 2: Initialize from localStorage with stable cache key
  const [data, setData] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`discover-${period}-${username}`);
    return cached || null;
  });

  const [loading, setLoading] = useState(data === null);

  useEffect(() => {
    const cacheKey = `discover-${period}-${username}`;

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
        // Fetch all raw data first
        const [scoreData, topArtistsData, topTracksData, topAlbumsData] =
          await Promise.all([
            getTopArtists(username, period, "100"),
            getTopArtists(username, period, "50"),
            getTopTracks(username, period, "50"),
            getTopAlbums(username, period, "50"),
          ]);

        const allArtists = scoreData.topartists?.artist || [];
        const artists = topArtistsData.topartists?.artist || [];
        const tracks = topTracksData.toptracks?.track || [];
        const albums = topAlbumsData.topalbums?.album || [];

        // Calculate discovery score
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
        const mostUnderground = sorted[0];
        const mostMainstream = sorted[sorted.length - 1];

        // Get artist recommendations
        const top50Names = new Set(
          artists.map((a: any) => a.name.toLowerCase()),
        );
        const top10Artists = artists.slice(0, 10);
        const allSimilarArtists: any[] = [];

        await Promise.all(
          top10Artists.map(async (artist: any) => {
            try {
              const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artist.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json&limit=20`,
              );
              const data = await res.json();
              const similar = data.similarartists?.artist || [];
              similar.forEach((s: any) => {
                if (!top50Names.has(s.name.toLowerCase())) {
                  allSimilarArtists.push(s);
                }
              });
            } catch {}
          }),
        );

        const artistScoreMap: Record<string, { artist: any; count: number }> =
          {};
        allSimilarArtists.forEach((artist) => {
          const key = artist.name.toLowerCase();
          if (!artistScoreMap[key]) {
            artistScoreMap[key] = { artist, count: 0 };
          }
          artistScoreMap[key].count++;
        });

        const topRecommendedArtists = Object.values(artistScoreMap)
          .sort((a, b) => b.count - a.count)
          .slice(0, 9)
          .map(({ artist }) => artist);

        // Fetch images for artists
        const artistsWithImages = await Promise.all(
          topRecommendedArtists.map(async (artist: any) => {
            const image = await fetchArtistImage(artist.name);
            return { name: artist.name, image };
          }),
        );

        // Get track recommendations
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

        const trackScoreMap: Record<string, { track: any; count: number }> = {};
        allSimilarTracks.forEach((track) => {
          const key = `${track.name}|||${track.artist}`.toLowerCase();
          if (!trackScoreMap[key]) {
            trackScoreMap[key] = { track, count: 0 };
          }
          trackScoreMap[key].count++;
        });

        const topRecommendedTracks = Object.values(trackScoreMap)
          .sort((a, b) => b.count - a.count)
          .slice(0, 9)
          .map(({ track }) => track);

        // Fetch images for tracks
        const tracksWithImages = await Promise.all(
          topRecommendedTracks.map(async (track: any) => {
            const image = await fetchTrackImage(track.name, track.artist);
            return { name: track.name, artist: track.artist, image };
          }),
        );

        // Get album recommendations
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

        const topRecommendedAlbums = allAlbums
          .sort((a, b) => b.score - a.score)
          .slice(0, 9);

        // Fetch images for albums
        const albumsWithImages = await Promise.all(
          topRecommendedAlbums.map(async (album: any) => {
            const image = await fetchAlbumImage(album.name, album.artist);
            return { name: album.name, artist: album.artist, image };
          }),
        );

        // Return fully processed data
        return {
          discoveryScore: undergroundScore,
          label: scoreLabel,
          mostUnderground,
          mostMainstream,
          recommendedArtists: artistsWithImages,
          recommendedTracks: tracksWithImages,
          recommendedAlbums: albumsWithImages,
        };
      },
      CACHE_TTL.DISCOVERY,
    ).then((processedData) => {
      if (JSON.stringify(processedData) !== JSON.stringify(data)) {
        setData(processedData);
      }
      setLoading(false);
    });
  }, [username, period]);

  if (loading && !data) return <SkeletonDiscover />;

  const discoveryScore = data?.discoveryScore || 0;
  const mainstreamScore = 100 - discoveryScore;
  const currentRecommendations =
    tab === "artists"
      ? data?.recommendedArtists
      : tab === "tracks"
        ? data?.recommendedTracks
        : data?.recommendedAlbums;

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

      {/* Discovery Score Card - Full Width */}
      <div className="discover-score-card">
        <p className="discover-score-value">{discoveryScore}%</p>
        <p className="discover-score-label">{data?.label}</p>

        {/* Two-bar visualization */}
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

        {/* Most underground/mainstream */}
        {data?.mostUnderground && data?.mostMainstream && (
          <div className="discover-score-extremes">
            <div className="discover-score-extreme">
              <p className="discover-score-extreme-label">most underground</p>
              <p className="discover-score-extreme-name">
                {data.mostUnderground.name}
              </p>
              <p className="discover-score-extreme-count">
                {data.mostUnderground.listeners.toLocaleString()} listeners
              </p>
            </div>
            <div className="discover-score-extreme">
              <p className="discover-score-extreme-label">most mainstream</p>
              <p className="discover-score-extreme-name">
                {data.mostMainstream.name}
              </p>
              <p className="discover-score-extreme-count">
                {data.mostMainstream.listeners.toLocaleString()} listeners
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      <div className="discover-recommendations">
        <h3 className="discover-heading">recommendations</h3>

        {/* Tab selector */}
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

        {/* Recommendations Grid */}
        <div className="discover-rec-grid">
          {currentRecommendations?.map((item: any, i: number) => (
            <div key={i} className="discover-rec-card">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="discover-rec-img"
                />
              ) : (
                <div className="discover-rec-placeholder">
                  {item.name.charAt(0)}
                </div>
              )}
              <div className="discover-rec-info">
                <a
                  href={`https://www.last.fm/${tab === "artists" ? "music" : tab === "tracks" ? "music" : "music"}/${(item.artist || item.name).replace(/ /g, "+")}${tab !== "artists" ? `/${tab === "tracks" ? "_" : "+"}/${item.name.replace(/ /g, "+")}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="discover-rec-name"
                >
                  {item.name}
                </a>
                {item.artist && (
                  <p className="discover-rec-artist">{item.artist}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Based on footer */}
      <div className="page-based-on">
        based on top 50 {tab} • {PERIODS.find((p) => p.value === period)?.label}
      </div>
    </div>
  );
}

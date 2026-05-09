import { useEffect, useState } from "react";
import { getTopArtists, getTopTracks, getTopAlbums } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";

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

const TYPES = ["artists", "tracks", "albums"];

const GRID_SIZES = [
  { label: "3×3", value: 3, count: 9 },
  { label: "4×4", value: 4, count: 16 },
  { label: "5×5", value: 5, count: 25 },
  { label: "6×6", value: 6, count: 36 },
];

const LASTFM_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

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

async function fetchAlbumImage(
  albumName: string,
  artistName: string,
  lastfmImage: string | null,
): Promise<string | null> {
  if (lastfmImage && !lastfmImage.includes(LASTFM_PLACEHOLDER_HASH)) {
    return lastfmImage;
  }

  try {
    const query = `${artistName} ${albumName}`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`,
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

export default function Charts({ username }: Props) {
  const [period, setPeriod] = useState("overall");
  const [type, setType] = useState("artists");
  const [gridSize, setGridSize] = useState(6);

  // Tier 2: Initialize from localStorage with stable cache key
  const [items, setItems] = useState<any[]>(() => {
    const gridCount = GRID_SIZES.find((g) => g.value === 6)?.count || 36;
    const cacheKey = `charts-${type}-${period}-${gridCount}-${username}`;
    const cached = getCachedDataSync<any[]>(cacheKey);
    return cached || [];
  });

  const [loading, setLoading] = useState(items.length === 0);

  useEffect(() => {
    const gridCount = GRID_SIZES.find((g) => g.value === gridSize)?.count || 9;

    let fetchFn: typeof getTopArtists;
    let dataKey: string;
    let itemKey: string;
    let cacheTTL: number;

    if (type === "artists") {
      fetchFn = getTopArtists;
      dataKey = "topartists";
      itemKey = "artist";
      cacheTTL = CACHE_TTL.TOP_ARTISTS;
    } else if (type === "tracks") {
      fetchFn = getTopTracks;
      dataKey = "toptracks";
      itemKey = "track";
      cacheTTL = CACHE_TTL.TOP_TRACKS;
    } else {
      fetchFn = getTopAlbums;
      dataKey = "topalbums";
      itemKey = "album";
      cacheTTL = CACHE_TTL.TOP_ALBUMS;
    }

    const cacheKey = `charts-${type}-${period}-${gridCount}-${username}`;

    // Check cache for this specific selection
    const cachedData = getCachedDataSync<any[]>(cacheKey);
    if (cachedData) {
      setItems(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    cachedFetch(
      cacheKey,
      async () => {
        const data = await fetchFn(username, period, String(gridCount));
        const rawItems = data[dataKey]?.[itemKey] || [];

        const itemsWithImages = await Promise.all(
          rawItems.map(async (item: any) => {
            let imageUrl: string | null = null;

            if (type === "artists") {
              imageUrl = await fetchArtistImage(item.name);
            } else if (type === "albums") {
              const artistName = item.artist?.name || "";
              const lastfmImage =
                item.image?.[3]?.["#text"] ||
                item.image?.[2]?.["#text"] ||
                null;
              imageUrl = await fetchAlbumImage(
                item.name,
                artistName,
                lastfmImage,
              );
            } else if (type === "tracks") {
              const artistName = item.artist?.name || "";
              imageUrl = await fetchTrackImage(item.name, artistName);
            }

            return {
              ...item,
              fetchedImage: imageUrl,
            };
          }),
        );

        return itemsWithImages;
      },
      cacheTTL,
    ).then((data) => {
      if (JSON.stringify(data) !== JSON.stringify(items)) {
        setItems(data);
      }
      setLoading(false);
    });
  }, [username, period, type, gridSize]);

  if (loading && items.length === 0) {
    return (
      <div className="charts-section">
        <div className="section-header">
          <h2 className="section-title">charts</h2>
          <p className="section-subtitle">
            explore your most played artists, tracks, and albums across
            different time periods
          </p>
        </div>
        <div className="charts-controls">
          <div className="charts-controls-row">
            <div className="control-group">
              {TYPES.map((t) => (
                <button
                  key={t}
                  className={`control-btn ${type === t ? "active" : ""}`}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="control-group">
              {GRID_SIZES.map((g) => (
                <button
                  key={g.value}
                  className={`control-btn ${gridSize === g.value ? "active" : ""}`}
                  onClick={() => setGridSize(g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="charts-controls-row">
            <div className="control-group control-group-full">
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
        </div>
        <div className="chart-grid chart-grid-6x6">
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} className="chart-cell">
              <div
                className="skeleton-image"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="charts-section">
      <div className="section-header">
        <h2 className="section-title">charts</h2>
        <p className="section-subtitle">
          explore your most played artists, tracks, and albums across different
          time periods
        </p>
      </div>
      <div className="charts-controls">
        <div className="charts-controls-row">
          <div className="control-group">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`control-btn ${type === t ? "active" : ""}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="control-group">
            {GRID_SIZES.map((g) => (
              <button
                key={g.value}
                className={`control-btn ${gridSize === g.value ? "active" : ""}`}
                onClick={() => setGridSize(g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="charts-controls-row">
          <div className="control-group control-group-full">
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
      </div>
      <div className="chart-grid-container">
        <div className={`chart-grid chart-grid-${gridSize}x${gridSize}`}>
          {items.map((item, i) => {
            const img = item.fetchedImage;
            const name = item.name;
            const plays = item.playcount;
            const firstLetter = name.charAt(0).toUpperCase();
            return (
              <div key={i} className="chart-cell">
                {img ? (
                  <img src={img} alt={name} />
                ) : (
                  <div className="chart-cell-placeholder">
                    <span className="chart-cell-letter">{firstLetter}</span>
                  </div>
                )}
                <div className="chart-cell-overlay">
                  <p className="chart-cell-name">{name}</p>
                  <p className="chart-cell-plays">
                    {Number(plays).toLocaleString()} plays
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Based on footer */}
      <div className="page-based-on">
        based on {PERIODS.find((p) => p.value === period)?.label} • top{" "}
        {GRID_SIZES.find((g) => g.value === gridSize)?.count} {type}
      </div>
    </div>
  );
}

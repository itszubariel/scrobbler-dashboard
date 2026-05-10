import { useEffect, useState, useCallback } from "react";
import { useModal } from "../context/ModalContext";
import { cachedFetch, CACHE_TTL } from "../lib/cache";

const API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
const LASTFM_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

function firstTwoSentences(text: string): string {
  if (!text) return "";
  // Strip Last.fm "read more" links
  const clean = text
    .replace(/<a\b[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 2).join(" ").trim();
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function lfm(method: string, params: Record<string, string>) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
}

async function getItunesTrackArt(
  artist: string,
  track: string,
): Promise<string | null> {
  try {
    const q = `${artist} ${track}`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`,
    );
    const data = await res.json();
    if (data.results?.[0]?.artworkUrl100) {
      return data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
    }
  } catch {}
  return null;
}

async function getItunesAlbumArt(
  artist: string,
  album: string,
): Promise<string | null> {
  try {
    const q = `${artist} ${album}`;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=1`,
    );
    const data = await res.json();
    if (data.results?.[0]?.artworkUrl100) {
      return data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");
    }
  } catch {}
  return null;
}

async function getDeezerArt(artist: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/.netlify/functions/deezer-image?artist=${encodeURIComponent(artist)}`,
    );
    const data = await res.json();
    return data.imageUrl || null;
  } catch {}
  return null;
}

// ── Fetch functions ───────────────────────────────────────────────────────────

async function fetchArtistData(name: string, username: string) {
  const [infoRes, imageUrl] = await Promise.all([
    lfm("artist.getInfo", { artist: name, username, autocorrect: "1" }),
    getDeezerArt(name),
  ]);
  const a = infoRes.artist;
  if (!a) return null;

  const tags = Array.isArray(a.tags?.tag)
    ? a.tags.tag.slice(0, 3).map((t: any) => t.name)
    : [];
  const similar = Array.isArray(a.similar?.artist)
    ? a.similar.artist.slice(0, 5).map((s: any) => s.name)
    : [];
  const bio = firstTwoSentences(a.bio?.content || "");

  return {
    name: a.name,
    url: a.url,
    listeners: Number(a.stats?.listeners || 0),
    globalPlaycount: Number(a.stats?.playcount || 0),
    userPlaycount: Number(a.stats?.userplaycount || 0),
    tags,
    bio,
    similar,
    image: imageUrl,
  };
}

async function fetchTrackData(name: string, artist: string, username: string) {
  const [infoRes, imageUrl] = await Promise.all([
    lfm("track.getInfo", { track: name, artist, username, autocorrect: "1" }),
    getItunesTrackArt(artist, name),
  ]);
  const t = infoRes.track;
  if (!t) return null;

  const tags = Array.isArray(t.toptags?.tag)
    ? t.toptags.tag.slice(0, 3).map((tg: any) => tg.name)
    : [];
  const wiki = firstTwoSentences(t.wiki?.content || "");
  const duration = Math.floor(Number(t.duration || 0) / 1000);

  return {
    name: t.name,
    artist: t.artist?.name || artist,
    album: t.album?.title || null,
    url: t.url,
    listeners: Number(t.listeners || 0),
    globalPlaycount: Number(t.playcount || 0),
    userPlaycount: Number(t.userplaycount || 0),
    loved: t.userloved === "1",
    duration,
    tags,
    wiki,
    image: imageUrl,
  };
}

async function fetchAlbumData(name: string, artist: string, username: string) {
  const infoRes = await lfm("album.getInfo", {
    album: name,
    artist,
    username,
    autocorrect: "1",
  });
  const a = infoRes.album;
  if (!a) return null;

  // Image: prefer Last.fm if not placeholder, else iTunes
  const lfmImage: string | null =
    a.image?.[3]?.["#text"] || a.image?.[2]?.["#text"] || null;
  const image =
    lfmImage && !lfmImage.includes(LASTFM_PLACEHOLDER_HASH)
      ? lfmImage
      : await getItunesAlbumArt(artist, name);

  const tags = Array.isArray(a.tags?.tag)
    ? a.tags.tag.slice(0, 3).map((t: any) => t.name)
    : [];
  const wiki = firstTwoSentences(a.wiki?.content || "");
  const tracks = Array.isArray(a.tracks?.track)
    ? a.tracks.track.slice(0, 10).map((t: any) => ({
        name: t.name,
        duration: Math.floor(Number(t.duration || 0)),
      }))
    : [];

  // Release year from wiki published date or tracks
  const releaseYear = a.wiki?.published
    ? new Date(a.wiki.published).getFullYear()
    : null;

  return {
    name: a.name,
    artist: a.artist,
    url: a.url,
    listeners: Number(a.listeners || 0),
    globalPlaycount: Number(a.playcount || 0),
    userPlaycount: Number(a.userplaycount || 0),
    releaseYear,
    tags,
    wiki,
    tracks,
    image,
  };
}

async function fetchGenreData(name: string) {
  const [infoRes, artistsRes] = await Promise.all([
    lfm("tag.getInfo", { tag: name }),
    lfm("tag.getTopArtists", { tag: name, limit: "10" }),
  ]);
  const tag = infoRes.tag;
  const topArtists = Array.isArray(artistsRes.topartists?.artist)
    ? artistsRes.topartists.artist.map((a: any) => a.name)
    : [];
  const wiki = firstTwoSentences(tag?.wiki?.content || "");

  return {
    name: tag?.name || name,
    url: `https://www.last.fm/tag/${encodeURIComponent(name)}`,
    reach: Number(tag?.reach || 0),
    taggings: Number(tag?.total || 0),
    wiki,
    topArtists,
  };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ModalSkeleton() {
  return (
    <div className="info-modal-body">
      <div className="info-modal-hero">
        <div
          className="skeleton-image"
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "8px",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            className="skeleton-text"
            style={{ width: "60%", height: "22px", marginBottom: "10px" }}
          />
          <div
            className="skeleton-text"
            style={{ width: "40%", height: "14px", marginBottom: "8px" }}
          />
          <div
            className="skeleton-text"
            style={{ width: "50%", height: "14px" }}
          />
        </div>
      </div>
      <div
        className="skeleton-text"
        style={{ width: "100%", height: "13px", marginBottom: "8px" }}
      />
      <div
        className="skeleton-text"
        style={{ width: "85%", height: "13px", marginBottom: "24px" }}
      />
      <div
        className="skeleton-text"
        style={{ width: "30%", height: "13px", marginBottom: "12px" }}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-button" style={{ width: "70px" }} />
        ))}
      </div>
    </div>
  );
}

// ── Content renderers ─────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-modal-stat">
      <span className="info-modal-stat-value">{value}</span>
      <span className="info-modal-stat-label">{label}</span>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="info-modal-tags">
      {tags.map((t) => (
        <span key={t} className="info-modal-tag">
          {t}
        </span>
      ))}
    </div>
  );
}

function ArtistContent({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchArtistData>>;
}) {
  if (!data) return <p className="info-modal-empty">no data found</p>;
  return (
    <div className="info-modal-body">
      <div className="info-modal-hero">
        {data.image ? (
          <img src={data.image} alt={data.name} className="info-modal-art" />
        ) : (
          <div className="info-modal-art-placeholder">
            {data.name.charAt(0)}
          </div>
        )}
        <div className="info-modal-hero-info">
          <h2 className="info-modal-title">{data.name}</h2>
          <div className="info-modal-stats">
            <StatPill
              label="listeners"
              value={(data.listeners || 0).toLocaleString()}
            />
            <StatPill
              label="scrobbles"
              value={(data.globalPlaycount || 0).toLocaleString()}
            />
            {(data.userPlaycount || 0) > 0 && (
              <StatPill
                label="your plays"
                value={(data.userPlaycount || 0).toLocaleString()}
              />
            )}
          </div>
        </div>
      </div>
      {data.bio && <p className="info-modal-bio">{data.bio}</p>}
      <TagList tags={data.tags ?? []} />
      {(data.similar ?? []).length > 0 && (
        <div className="info-modal-section">
          <p className="info-modal-section-label">similar artists</p>
          <p className="info-modal-similar">
            {(data.similar ?? []).join(" · ")}
          </p>
        </div>
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="info-modal-lfm-link"
      >
        view on last.fm →
      </a>
    </div>
  );
}

function TrackContent({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchTrackData>>;
}) {
  if (!data) return <p className="info-modal-empty">no data found</p>;
  return (
    <div className="info-modal-body">
      <div className="info-modal-hero">
        {data.image ? (
          <img src={data.image} alt={data.name} className="info-modal-art" />
        ) : (
          <div className="info-modal-art-placeholder">
            {data.name.charAt(0)}
          </div>
        )}
        <div className="info-modal-hero-info">
          <h2 className="info-modal-title">{data.name}</h2>
          <p className="info-modal-subtitle">{data.artist}</p>
          {data.album && (
            <p className="info-modal-subtitle info-modal-subtitle-muted">
              {data.album}
            </p>
          )}
          <div className="info-modal-stats">
            <StatPill
              label="listeners"
              value={(data.listeners || 0).toLocaleString()}
            />
            <StatPill
              label="scrobbles"
              value={(data.globalPlaycount || 0).toLocaleString()}
            />
            {(data.userPlaycount || 0) > 0 && (
              <StatPill
                label="your plays"
                value={(data.userPlaycount || 0).toLocaleString()}
              />
            )}
            {(data.duration || 0) > 0 && (
              <StatPill
                label="duration"
                value={formatDuration(data.duration)}
              />
            )}
            {data.loved && <StatPill label="" value="♥ loved" />}
          </div>
        </div>
      </div>
      {data.wiki && <p className="info-modal-bio">{data.wiki}</p>}
      <TagList tags={data.tags ?? []} />
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="info-modal-lfm-link"
      >
        view on last.fm →
      </a>
    </div>
  );
}

function AlbumContent({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchAlbumData>>;
}) {
  if (!data) return <p className="info-modal-empty">no data found</p>;
  return (
    <div className="info-modal-body">
      <div className="info-modal-hero">
        {data.image ? (
          <img src={data.image} alt={data.name} className="info-modal-art" />
        ) : (
          <div className="info-modal-art-placeholder">
            {data.name.charAt(0)}
          </div>
        )}
        <div className="info-modal-hero-info">
          <h2 className="info-modal-title">{data.name}</h2>
          <p className="info-modal-subtitle">{data.artist}</p>
          {data.releaseYear && (
            <p className="info-modal-subtitle info-modal-subtitle-muted">
              {data.releaseYear}
            </p>
          )}
          <div className="info-modal-stats">
            <StatPill
              label="listeners"
              value={(data.listeners || 0).toLocaleString()}
            />
            <StatPill
              label="scrobbles"
              value={(data.globalPlaycount || 0).toLocaleString()}
            />
            {(data.userPlaycount || 0) > 0 && (
              <StatPill
                label="your plays"
                value={(data.userPlaycount || 0).toLocaleString()}
              />
            )}
          </div>
        </div>
      </div>
      {data.wiki && <p className="info-modal-bio">{data.wiki}</p>}
      <TagList tags={data.tags ?? []} />
      {(data.tracks ?? []).length > 0 && (
        <div className="info-modal-section">
          <p className="info-modal-section-label">tracklist</p>
          <ol className="info-modal-tracklist">
            {(data.tracks ?? []).map((t: any, i: number) => (
              <li key={i} className="info-modal-track-item">
                <span className="info-modal-track-name">{t.name}</span>
                {t.duration > 0 && (
                  <span className="info-modal-track-dur">
                    {formatDuration(t.duration)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="info-modal-lfm-link"
      >
        view on last.fm →
      </a>
    </div>
  );
}

function GenreContent({
  data,
}: {
  data: Awaited<ReturnType<typeof fetchGenreData>>;
}) {
  if (!data) return <p className="info-modal-empty">no data found</p>;
  return (
    <div className="info-modal-body">
      <div className="info-modal-hero" style={{ alignItems: "center" }}>
        <div className="info-modal-genre-icon">#</div>
        <div className="info-modal-hero-info">
          <h2 className="info-modal-title">{data.name}</h2>
          <div className="info-modal-stats">
            {(data.reach || 0) > 0 && (
              <StatPill
                label="reach"
                value={(data.reach || 0).toLocaleString()}
              />
            )}
            {(data.taggings || 0) > 0 && (
              <StatPill
                label="taggings"
                value={(data.taggings || 0).toLocaleString()}
              />
            )}
          </div>
        </div>
      </div>
      {data.wiki && <p className="info-modal-bio">{data.wiki}</p>}
      {(data.topArtists ?? []).length > 0 && (
        <div className="info-modal-section">
          <p className="info-modal-section-label">top artists</p>
          <p className="info-modal-similar">
            {(data.topArtists ?? []).join(" · ")}
          </p>
        </div>
      )}
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="info-modal-lfm-link"
      >
        view on last.fm →
      </a>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function InfoModal() {
  const { modal, closeModal } = useModal();
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  // Clear any stale info cache entries that may have been cached before defensive fixes
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("scrobbler_cache_info-")) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) closeModal();
    },
    [closeModal],
  );

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  // Fetch data when modal opens — use primitive deps to avoid re-firing on object identity changes
  useEffect(() => {
    if (!modal) {
      setLoading(false);
      return;
    }
    const { type, name, artist, username } = modal;
    setLoading(true);
    setModalData(null);
    const cacheKey =
      type === "artist"
        ? `info-artist-${name}`
        : type === "track"
          ? `info-track-${name}-${artist}`
          : type === "album"
            ? `info-album-${name}-${artist}`
            : `info-genre-${name}`;

    const fetcher: () => Promise<any> = () => {
      if (type === "artist") return fetchArtistData(name, username);
      if (type === "track") return fetchTrackData(name, artist || "", username);
      if (type === "album") return fetchAlbumData(name, artist || "", username);
      return fetchGenreData(name);
    };

    cachedFetch(cacheKey, fetcher, CACHE_TTL.TOP_ARTISTS /* 2h */).then(
      (data) => {
        setModalData(data);
        setLoading(false);
      },
    );
  }, [modal?.type, modal?.name, modal?.artist, modal?.username]);

  if (!modal) return null;

  return (
    <div className="info-modal-backdrop" onClick={handleBackdropClick}>
      <div className="info-modal-card" role="dialog" aria-modal="true">
        <button
          className="info-modal-close"
          onClick={closeModal}
          aria-label="Close"
        >
          ✕
        </button>
        {loading ? (
          <ModalSkeleton />
        ) : modal.type === "artist" ? (
          <ArtistContent data={modalData} />
        ) : modal.type === "track" ? (
          <TrackContent data={modalData} />
        ) : modal.type === "album" ? (
          <AlbumContent data={modalData} />
        ) : (
          <GenreContent data={modalData} />
        )}
      </div>
    </div>
  );
}

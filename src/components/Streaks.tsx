import { useEffect, useState } from "react";
import { getRecentTracksPaginated } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync } from "../lib/cache";
import { SkeletonStreaks } from "./SkeletonLoader";
import { useModal } from "../context/ModalContext";
import type { ModalType } from "../context/ModalContext";

interface Props {
  username: string;
}

const STREAK_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_PAGES = 10;
const PAGE_LIMIT = 200;
const LOOKBACK_DAYS = 90;

interface StreakEntry {
  name: string;
  subName?: string; // artist name for tracks/albums
  days: number;
  lastDay: string; // YYYY-MM-DD
  active: boolean;
  daysAgo: number;
}

interface StreaksData {
  artists: StreakEntry[];
  tracks: StreakEntry[];
  albums: StreakEntry[];
}

/** Convert a Unix timestamp (seconds) to a YYYY-MM-DD string in local time */
function toDateStr(uts: number): string {
  const d = new Date(uts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Days between two YYYY-MM-DD strings */
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/** Today as YYYY-MM-DD */
function today(): string {
  return toDateStr(Date.now() / 1000);
}

/**
 * Given a map of key → Set<YYYY-MM-DD>, find the longest consecutive-day
 * streak for each key. Returns entries with streak >= 2 days, sorted desc.
 */
function computeStreaks(
  dayMap: Map<string, Set<string>>,
  todayStr: string,
): StreakEntry[] {
  const results: StreakEntry[] = [];

  dayMap.forEach((days, key) => {
    const sorted = Array.from(days).sort(); // ascending
    if (sorted.length < 2) return;

    let bestLen = 1;
    let bestEnd = sorted[0];
    let curLen = 1;
    let curEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
        curLen++;
        curEnd = sorted[i];
        if (curLen > bestLen) {
          bestLen = curLen;
          bestEnd = curEnd;
        }
      } else {
        curLen = 1;
        curEnd = sorted[i];
      }
    }

    if (bestLen < 2) return;

    const daysAgo = daysBetween(bestEnd, todayStr);
    results.push({
      name: key,
      days: bestLen,
      lastDay: bestEnd,
      active: daysAgo <= 3,
      daysAgo,
    });
  });

  return results.sort((a, b) => b.days - a.days);
}

async function fetchStreaksData(username: string): Promise<StreaksData> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffUts = Math.floor(cutoff.getTime() / 1000);

  const artistDays = new Map<string, Set<string>>();
  const trackDays = new Map<string, Set<string>>();
  const albumDays = new Map<string, Set<string>>();

  outer: for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await getRecentTracksPaginated(
      username,
      String(PAGE_LIMIT),
      String(page),
    );
    const tracks: any[] = data.recenttracks?.track || [];

    for (const t of tracks) {
      // Skip now-playing (no date)
      if (t["@attr"]?.nowplaying === "true" || !t.date?.uts) continue;

      const uts = Number(t.date.uts);
      if (uts < cutoffUts) break outer; // past 90-day window, stop

      const dateStr = toDateStr(uts);
      const artistName: string = t.artist?.["#text"] || t.artist?.name || "";
      const trackName: string = t.name || "";
      const albumName: string = t.album?.["#text"] || "";

      // Artist map
      if (artistName) {
        if (!artistDays.has(artistName)) artistDays.set(artistName, new Set());
        artistDays.get(artistName)!.add(dateStr);
      }

      // Track map — key: trackName|||artistName
      if (trackName && artistName) {
        const trackKey = `${trackName}|||${artistName}`;
        if (!trackDays.has(trackKey)) trackDays.set(trackKey, new Set());
        trackDays.get(trackKey)!.add(dateStr);
      }

      // Album map — key: albumName|||artistName
      if (albumName && artistName) {
        const albumKey = `${albumName}|||${artistName}`;
        if (!albumDays.has(albumKey)) albumDays.set(albumKey, new Set());
        albumDays.get(albumKey)!.add(dateStr);
      }
    }

    // If fewer tracks than limit, no more pages
    if (tracks.length < PAGE_LIMIT) break;
  }

  const todayStr = today();

  const rawArtists = computeStreaks(artistDays, todayStr).slice(0, 3);
  const rawTracks = computeStreaks(trackDays, todayStr)
    .slice(0, 3)
    .map((e) => {
      const [name, subName] = e.name.split("|||");
      return { ...e, name, subName };
    });
  const rawAlbums = computeStreaks(albumDays, todayStr)
    .slice(0, 3)
    .map((e) => {
      const [name, subName] = e.name.split("|||");
      return { ...e, name, subName };
    });

  return { artists: rawArtists, tracks: rawTracks, albums: rawAlbums };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RANK_LABELS = ["1", "2", "3"];

function StreakRow({
  entry,
  rank,
  category,
}: {
  entry: StreakEntry;
  rank: number;
  category: "artists" | "tracks" | "albums";
}) {
  const { openModal } = useModal();

  const modalType: ModalType =
    category === "artists"
      ? "artist"
      : category === "tracks"
        ? "track"
        : "album";

  return (
    <div className="streaks-row">
      <span className="streaks-rank">{RANK_LABELS[rank]}</span>
      <div className="streaks-info">
        <button
          className="streaks-name"
          onClick={() => openModal(modalType, entry.name, entry.subName)}
        >
          {entry.name}
        </button>
        {entry.subName && <p className="streaks-sub">{entry.subName}</p>}
      </div>
      <div className="streaks-meta">
        <span className="streaks-days">{entry.days} days</span>
        {entry.active ? (
          <span className="streaks-active">🔥 active</span>
        ) : (
          <span className="streaks-ended">ended {entry.daysAgo}d ago</span>
        )}
      </div>
    </div>
  );
}

function StreakCategory({
  title,
  entries,
  category,
}: {
  title: string;
  entries: StreakEntry[];
  category: "artists" | "tracks" | "albums";
}) {
  if (entries.length === 0) {
    return (
      <div className="streaks-category">
        <h3 className="streaks-category-title">{title}</h3>
        <p className="streaks-empty">no streaks found in the last 90 days</p>
      </div>
    );
  }
  return (
    <div className="streaks-category">
      <h3 className="streaks-category-title">{title}</h3>
      {entries.map((entry, i) => (
        <StreakRow
          key={entry.name + (entry.subName ?? "")}
          entry={entry}
          rank={i}
          category={category}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Streaks({ username }: Props) {
  const [data, setData] = useState<StreaksData | null>(
    () => getCachedDataSync<StreaksData>(`streaks-${username}`) || null,
  );
  const [loading, setLoading] = useState(data === null);

  useEffect(() => {
    const cacheKey = `streaks-${username}`;
    const cached = getCachedDataSync<StreaksData>(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    cachedFetch(
      cacheKey,
      () => fetchStreaksData(username),
      STREAK_CACHE_TTL,
    ).then((result) => {
      setData(result);
      setLoading(false);
    });
  }, [username]);

  if (loading || !data) return <SkeletonStreaks />;

  return (
    <div className="streaks-section">
      <div className="section-header">
        <h2 className="section-title">streaks</h2>
        <p className="section-subtitle">
          your longest consecutive daily listening streaks in the last 90 days
        </p>
      </div>

      <StreakCategory
        title="artist streaks"
        entries={data.artists}
        category="artists"
      />
      <StreakCategory
        title="track streaks"
        entries={data.tracks}
        category="tracks"
      />
      <StreakCategory
        title="album streaks"
        entries={data.albums}
        category="albums"
      />

      <div className="page-based-on">
        based on last 90 days • up to {MAX_PAGES * PAGE_LIMIT} scrobbles
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getTopArtists } from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";
import { SkeletonTaste } from "./SkeletonLoader";

interface Props {
  username: string;
}

const COLORS = [
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#facc15",
  "#38bdf8",
  "#f87171",
  "#a3e635",
  "#e879f9",
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

export default function Taste({ username }: Props) {
  // Tier 2: Persistent cache with stable key
  const [genres, setGenres] = useState<{ name: string; percentage: number }[]>(
    () => {
      const cached = getCachedDataSync<{ name: string; percentage: number }[]>(
        `taste-${username}`,
      );
      return cached || [];
    },
  );
  const [loading, setLoading] = useState(genres.length === 0);

  useEffect(() => {
    cachedFetch(
      `taste-${username}`,
      async () => {
        const data = await getTopArtists(username, "overall", "50");
        const artists = data.topartists?.artist || [];

        // Step 1: Build artist name set for filtering
        const artistNames = new Set(
          artists.map((a: any) => a.name.toLowerCase()),
        );

        // Step 2: Fetch artist info and weight tags by playcount
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

              // Weight each tag by this artist's playcount
              tags.forEach((t: any) => {
                const tagName = t.name.toLowerCase();

                // Filter out blocked tags
                if (BLOCKED_TAGS.includes(tagName)) return;
                if (isYearTag(tagName)) return;
                if (artistNames.has(tagName)) return;

                // Add playcount weight to this tag
                tagWeights[tagName] = (tagWeights[tagName] || 0) + playcount;
              });
            } catch {}
          }),
        );

        // Step 3: Sort by weight and take top 50
        const sortedTags = Object.entries(tagWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50);

        // Step 4: Calculate percentages
        const totalWeight = sortedTags.reduce(
          (sum, [_, weight]) => sum + weight,
          0,
        );

        const genresWithPercentages = sortedTags.map(([name, weight]) => ({
          name,
          percentage:
            totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
        }));

        return genresWithPercentages;
      },
      CACHE_TTL.TASTE,
    ).then((data) => {
      if (JSON.stringify(data) !== JSON.stringify(genres)) {
        setGenres(data);
      }
      setLoading(false);
    });
  }, [username]);

  if (loading) return <SkeletonTaste />;

  const maxPercentage = genres[0]?.percentage || 1;

  return (
    <div className="taste-section">
      <div className="section-header">
        <h2 className="section-title">taste</h2>
        <p className="section-subtitle">
          your music personality, broken down by genre
        </p>
      </div>
      <div className="taste-container">
        <div className="taste-list">
          {genres.map((g, i) => (
            <div key={i} className="taste-row">
              <span className="taste-rank">{i + 1}</span>
              <a
                href={`https://www.last.fm/tag/${encodeURIComponent(g.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="taste-name taste-name-link"
              >
                {g.name}
              </a>
              <div className="taste-track">
                <div
                  className="taste-fill"
                  style={{
                    width: `${(g.percentage / maxPercentage) * 100}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <span
                className="taste-pct"
                style={{ color: COLORS[i % COLORS.length] }}
              >
                {g.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Based on footer */}
      <div className="page-based-on">
        based on top 50 artists • weighted by playcount
      </div>
    </div>
  );
}

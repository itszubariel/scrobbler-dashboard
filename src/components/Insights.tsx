import { useEffect, useState } from "react";
import {
  getTopArtists,
  getTopTracks,
  getTopAlbums,
  getUserInfo,
} from "../lib/lastfm";
import { cachedFetch, getCachedDataSync, CACHE_TTL } from "../lib/cache";
import { SkeletonInsights } from "./SkeletonLoader";

interface Props {
  username: string;
}

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

// Jaccard similarity: intersection / union
function jaccardScore(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((k) => setB.has(k)).length;
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

export default function Insights({ username }: Props) {
  // Tier 2: Persistent cache with stable key
  const [personality, setPersonality] = useState<any>(() => {
    const cached = getCachedDataSync<any>(`insights-personality-${username}`);
    return cached || null;
  });
  const [compareUsername, setCompareUsername] = useState("");
  const [compatibility, setCompatibility] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [compatError, setCompatError] = useState("");

  useEffect(() => {
    // Fetch personality data
    cachedFetch(
      `insights-personality-${username}`,
      async () => {
        const [overallRes, recentRes, userRes] = await Promise.all([
          getTopArtists(username, "overall", "100"),
          getTopArtists(username, "7day", "50"),
          getUserInfo(username),
        ]);

        const overallArtists = overallRes.topartists?.artist || [];
        const recentArtists = recentRes.topartists?.artist || [];
        const user = userRes.user;

        // LOYALTY: Weekly overlap with all-time
        const overallNames = new Set(
          overallArtists.map((a: any) => a.name.toLowerCase()),
        );
        const recentNames = new Set(
          recentArtists.map((a: any) => a.name.toLowerCase()),
        );
        const overlap = [...recentNames].filter((n) =>
          overallNames.has(n),
        ).length;
        const loyalty = Math.round(
          (overlap / Math.max(recentNames.size, 1)) * 100,
        );

        // DIVERSITY: Genre dominance (inverted)
        const artistNames = new Set(
          overallArtists.map((a: any) => a.name.toLowerCase()),
        );
        const tagWeights: Record<string, number> = {};

        await Promise.all(
          overallArtists.map(async (artist: any) => {
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
                CACHE_TTL.PERSONALITY,
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
        const topGenrePercentage =
          totalWeight > 0 ? (sortedTags[0]?.[1] / totalWeight) * 100 : 0;
        const diversity = Math.min(
          Math.round((1 - topGenrePercentage / 100) * 150),
          100,
        );

        // MAINSTREAM: Weighted listener counts
        const listenerData = await Promise.all(
          overallArtists.map(async (a: any) => {
            try {
              const info = await cachedFetch(
                `artist-info-${a.name}`,
                async () => {
                  const res = await fetch(
                    `https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&artist=${encodeURIComponent(a.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json`,
                  );
                  return res.json();
                },
                CACHE_TTL.PERSONALITY,
              );
              const listeners = Number(info.artist?.stats?.listeners || 0);
              const playcount = Number(a.playcount) || 0;
              return { listeners, playcount };
            } catch {
              return { listeners: 0, playcount: 0 };
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
        const mainstream =
          totalPlaycount > 0
            ? Math.round(weightedMainstream / totalPlaycount)
            : 0;

        // INTENSITY: Scrobbles per month
        const daysSince = Math.floor(
          (Date.now() - Number(user.registered?.unixtime) * 1000) /
            (1000 * 60 * 60 * 24),
        );
        const monthsSince = daysSince / 30.44;
        const scrobblesPerMonth = Number(user.playcount) / monthsSince;
        const intensity = Math.min(
          Math.round((scrobblesPerMonth / 300) * 100),
          100,
        );

        // NOSTALGIA: Fixed at 50% (placeholder)
        const nostalgia = 50;

        // Determine personality type
        const dimensions = [
          { name: "loyalty", score: loyalty },
          { name: "diversity", score: diversity },
          { name: "mainstream", score: mainstream },
          { name: "intensity", score: intensity },
          { name: "nostalgia", score: nostalgia },
        ].sort((a, b) => b.score - a.score);

        let personalityType = "the listener";
        let description = "you just love music.";

        const top1 = dimensions[0];
        const top2 = dimensions[1];
        const diff = Math.abs(top1.score - top2.score);

        if (diff <= 10) {
          // Combination personalities
          const combo = [top1.name, top2.name].sort().join("+");
          if (combo === "intensity+loyalty") {
            personalityType = "the collector";
            description = "deep cuts, high playcounts, unwavering dedication.";
          } else if (combo === "diversity+mainstream") {
            personalityType = "the curator";
            description =
              "you know every genre but always know what's trending.";
          } else if (combo === "diversity+intensity") {
            personalityType = "the fanatic";
            description = "endlessly curious and endlessly listening.";
          }
        } else {
          // Single dimension personalities
          if (top1.name === "loyalty") {
            personalityType = "the loyalist";
            description =
              "you find your sound and stick with it. your favorites are your forever favorites.";
          } else if (top1.name === "diversity") {
            personalityType = "the explorer";
            description =
              "you roam freely across genres and scenes, always searching for something new.";
          } else if (top1.name === "mainstream") {
            personalityType = "the trendsetter";
            description =
              "you're plugged into the pulse of popular music and love what's hot.";
          } else if (top1.name === "intensity") {
            personalityType = "the obsessive";
            description =
              "music isn't background noise for you. it's everything.";
          }
        }

        return {
          type: personalityType,
          description,
          dimensions: dimensions.map((d) => ({
            ...d,
            name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
          })),
        };
      },
      CACHE_TTL.PERSONALITY,
    ).then((personalityData) => {
      if (JSON.stringify(personalityData) !== JSON.stringify(personality)) {
        setPersonality(personalityData);
      }
    });
  }, [username]);

  async function handleCompare() {
    if (!compareUsername.trim()) return;
    if (compareUsername.toLowerCase() === username.toLowerCase()) {
      setCompatError("you can't compare yourself with yourself!");
      return;
    }

    setComparing(true);
    setCompatError("");
    setCompatibility(null);

    try {
      const [
        user1Artists,
        user1Tracks,
        user1Albums,
        user2Artists,
        user2Tracks,
        user2Albums,
      ] = await Promise.all([
        cachedFetch(
          `compat-artists-${username}`,
          () => getTopArtists(username, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
        cachedFetch(
          `compat-tracks-${username}`,
          () => getTopTracks(username, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
        cachedFetch(
          `compat-albums-${username}`,
          () => getTopAlbums(username, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
        cachedFetch(
          `compat-artists-${compareUsername}`,
          () => getTopArtists(compareUsername, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
        cachedFetch(
          `compat-tracks-${compareUsername}`,
          () => getTopTracks(compareUsername, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
        cachedFetch(
          `compat-albums-${compareUsername}`,
          () => getTopAlbums(compareUsername, "overall", "100"),
          CACHE_TTL.PERSONALITY,
        ),
      ]);

      const u1Artists = user1Artists.topartists?.artist || [];
      const u1Tracks = user1Tracks.toptracks?.track || [];
      const u1Albums = user1Albums.topalbums?.album || [];
      const u2Artists = user2Artists.topartists?.artist || [];
      const u2Tracks = user2Tracks.toptracks?.track || [];
      const u2Albums = user2Albums.topalbums?.album || [];

      // Get genres for both users
      const getGenres = async (artists: any[]) => {
        const tagCounts: Record<string, number> = {};
        await Promise.all(
          artists.slice(0, 30).map(async (a: any) => {
            try {
              const tags = await cachedFetch(
                `artist-tags-${a.name}`,
                async () => {
                  const res = await fetch(
                    `https://ws.audioscrobbler.com/2.0/?method=artist.getTopTags&artist=${encodeURIComponent(a.name)}&api_key=${import.meta.env.VITE_LASTFM_API_KEY}&format=json`,
                  );
                  const d = await res.json();
                  return d.toptags?.tag?.slice(0, 3) || [];
                },
                CACHE_TTL.PERSONALITY,
              );
              tags.forEach((t: any) => {
                const name = t.name.toLowerCase();
                tagCounts[name] = (tagCounts[name] || 0) + 1;
              });
            } catch {}
          }),
        );
        return new Set(Object.keys(tagCounts).slice(0, 30));
      };

      const u1Genres = await getGenres(u1Artists);
      const u2Genres = await getGenres(u2Artists);

      // Normalize data
      const artistSet1 = new Set<string>(
        u1Artists.map((a: any) => a.name.toLowerCase()),
      );
      const artistSet2 = new Set<string>(
        u2Artists.map((a: any) => a.name.toLowerCase()),
      );

      const trackSet1 = new Set<string>(
        u1Tracks.map(
          (t: any) =>
            `${t.name.toLowerCase()}::${t.artist?.name?.toLowerCase()}`,
        ),
      );
      const trackSet2 = new Set<string>(
        u2Tracks.map(
          (t: any) =>
            `${t.name.toLowerCase()}::${t.artist?.name?.toLowerCase()}`,
        ),
      );

      const albumSet1 = new Set<string>(
        u1Albums.map(
          (a: any) =>
            `${a.name.toLowerCase()}::${a.artist?.name?.toLowerCase()}`,
        ),
      );
      const albumSet2 = new Set<string>(
        u2Albums.map(
          (a: any) =>
            `${a.name.toLowerCase()}::${a.artist?.name?.toLowerCase()}`,
        ),
      );

      // Calculate Jaccard scores
      const artistScore = jaccardScore(artistSet1, artistSet2);
      const trackScore = jaccardScore(trackSet1, trackSet2);
      const albumScore = jaccardScore(albumSet1, albumSet2);
      const genreScore = jaccardScore(u1Genres, u2Genres);

      // Weighted overall score
      const overall = Math.round(
        genreScore * 0.35 +
          artistScore * 0.3 +
          trackScore * 0.2 +
          albumScore * 0.15,
      );

      // Compatibility label
      let label = "very different";
      if (overall > 80) label = "musical soulmates";
      else if (overall > 60) label = "great match";
      else if (overall > 40) label = "decent taste match";
      else if (overall > 20) label = "some overlap";

      // Shared items
      const sharedArtistNames = [...artistSet1].filter((a) =>
        artistSet2.has(a),
      );
      const sharedArtists = u1Artists
        .filter((a: any) => sharedArtistNames.includes(a.name.toLowerCase()))
        .slice(0, 3);

      const sharedGenres = [...u1Genres]
        .filter((g) => u2Genres.has(g))
        .slice(0, 3);

      const sharedTrackKeys = [...trackSet1].filter((t) => trackSet2.has(t));
      const sharedTracks = u1Tracks
        .filter((t: any) =>
          sharedTrackKeys.includes(
            `${t.name.toLowerCase()}::${t.artist?.name?.toLowerCase()}`,
          ),
        )
        .slice(0, 3);

      const sharedAlbumKeys = [...albumSet1].filter((a) => albumSet2.has(a));
      const sharedAlbums = u1Albums
        .filter((a: any) =>
          sharedAlbumKeys.includes(
            `${a.name.toLowerCase()}::${a.artist?.name?.toLowerCase()}`,
          ),
        )
        .slice(0, 3);

      setCompatibility({
        overall,
        label,
        artistScore,
        trackScore,
        albumScore,
        genreScore,
        sharedArtists,
        sharedTracks,
        sharedAlbums,
        sharedGenres,
      });
    } catch (error) {
      setCompatError("couldn't fetch last.fm data for one or both users");
    }
    setComparing(false);
  }

  if (!personality) return <SkeletonInsights />;

  return (
    <div className="insights-section">
      <div className="section-header">
        <h2 className="section-title">insights</h2>
        <p className="section-subtitle">
          deep dive into your listening personality and find your music
          soulmates
        </p>
      </div>

      {/* PERSONALITY */}
      <div className="insights-personality">
        <h3 className="insights-heading">music personality</h3>
        <div className="insights-personality-result">
          <div className="insights-personality-header">
            <h4 className="insights-personality-type">{personality.type}</h4>
            <p className="insights-personality-desc">
              {personality.description}
            </p>
          </div>
          <div className="insights-dimensions">
            {personality.dimensions.map((dim: any, i: number) => (
              <div key={i} className="insights-dimension">
                <div className="insights-dimension-header">
                  <span className="insights-dimension-label">{dim.name}</span>
                  <span className="insights-dimension-value">{dim.score}%</span>
                </div>
                <div className="insights-dimension-bar">
                  <div
                    className="insights-dimension-fill"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPATIBILITY */}
      <div className="insights-compatibility">
        <h3 className="insights-heading">compatibility checker</h3>
        <div className="insights-compare-form">
          <input
            type="text"
            value={compareUsername}
            onChange={(e) => setCompareUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCompare()}
            placeholder="enter last.fm username"
            className="insights-compare-input"
          />
          <button onClick={handleCompare} disabled={comparing} className="btn">
            {comparing ? "comparing..." : "compare"}
          </button>
        </div>

        {compatError && <p className="insights-error">{compatError}</p>}

        {compatibility && !compatError && (
          <div className="insights-compatibility-result">
            <div className="insights-compat-header">
              <p className="insights-compat-score">{compatibility.overall}%</p>
              <p className="insights-compat-label">{compatibility.label}</p>
            </div>

            {/* Score bars */}
            <div className="insights-compat-bars">
              <div className="insights-compat-bar-row">
                <span className="insights-compat-bar-label">artists</span>
                <div className="insights-compat-bar-track">
                  <div
                    className="insights-compat-bar-fill insights-compat-bar-artists"
                    style={{ width: `${compatibility.artistScore}%` }}
                  />
                </div>
                <span className="insights-compat-bar-pct">
                  {compatibility.artistScore}%
                </span>
              </div>
              <div className="insights-compat-bar-row">
                <span className="insights-compat-bar-label">tracks</span>
                <div className="insights-compat-bar-track">
                  <div
                    className="insights-compat-bar-fill insights-compat-bar-tracks"
                    style={{ width: `${compatibility.trackScore}%` }}
                  />
                </div>
                <span className="insights-compat-bar-pct">
                  {compatibility.trackScore}%
                </span>
              </div>
              <div className="insights-compat-bar-row">
                <span className="insights-compat-bar-label">albums</span>
                <div className="insights-compat-bar-track">
                  <div
                    className="insights-compat-bar-fill insights-compat-bar-albums"
                    style={{ width: `${compatibility.albumScore}%` }}
                  />
                </div>
                <span className="insights-compat-bar-pct">
                  {compatibility.albumScore}%
                </span>
              </div>
              <div className="insights-compat-bar-row">
                <span className="insights-compat-bar-label">genres</span>
                <div className="insights-compat-bar-track">
                  <div
                    className="insights-compat-bar-fill insights-compat-bar-genres"
                    style={{ width: `${compatibility.genreScore}%` }}
                  />
                </div>
                <span className="insights-compat-bar-pct">
                  {compatibility.genreScore}%
                </span>
              </div>
            </div>

            {/* Shared items */}
            {(compatibility.sharedArtists.length > 0 ||
              compatibility.sharedGenres.length > 0) && (
              <div className="insights-shared">
                {compatibility.sharedArtists.length > 0 && (
                  <div className="insights-shared-section">
                    <p className="insights-shared-heading">shared artists</p>
                    {compatibility.sharedArtists.map((a: any, i: number) => (
                      <p key={i} className="insights-shared-item">
                        {a.name}
                      </p>
                    ))}
                  </div>
                )}
                {compatibility.sharedTracks.length > 0 && (
                  <div className="insights-shared-section">
                    <p className="insights-shared-heading">shared tracks</p>
                    {compatibility.sharedTracks.map((t: any, i: number) => (
                      <p key={i} className="insights-shared-item">
                        {t.name} — {t.artist?.name}
                      </p>
                    ))}
                  </div>
                )}
                {compatibility.sharedAlbums.length > 0 && (
                  <div className="insights-shared-section">
                    <p className="insights-shared-heading">shared albums</p>
                    {compatibility.sharedAlbums.map((a: any, i: number) => (
                      <p key={i} className="insights-shared-item">
                        {a.name}
                      </p>
                    ))}
                  </div>
                )}
                {compatibility.sharedGenres.length > 0 && (
                  <div className="insights-shared-section">
                    <p className="insights-shared-heading">shared genres</p>
                    {compatibility.sharedGenres.map((g: string, i: number) => (
                      <p key={i} className="insights-shared-item">
                        {g}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {compatibility.overall === 0 && (
              <p className="insights-no-overlap">
                no overlap found — you two are musical opposites!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Based on footer */}
      <div className="page-based-on">
        based on top 100 artists, tracks, and albums • all time
      </div>
    </div>
  );
}

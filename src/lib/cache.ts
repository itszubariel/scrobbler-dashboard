interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

// Tier 1: Memory-only cache (resets on page refresh)
const memoryCache = new Map<string, any>();

// Tier 2: Persistent cache with localStorage
const persistentCache = new Map<string, CacheEntry>();

export const CACHE_TTL = {
  NOW_PLAYING: 5 * 60 * 1000, // 5 minutes
  RECENT_TRACKS: 5 * 60 * 1000, // 5 minutes
  TOP_ARTISTS: 2 * 60 * 60 * 1000, // 2 hours
  TOP_TRACKS: 2 * 60 * 60 * 1000, // 2 hours
  TOP_ALBUMS: 2 * 60 * 60 * 1000, // 2 hours
  TASTE: 2 * 60 * 60 * 1000, // 2 hours
  PERSONALITY: 6 * 60 * 60 * 1000, // 6 hours
  DISCOVERY: 6 * 60 * 60 * 1000, // 6 hours
};

function getFromLocalStorage(key: string): CacheEntry | null {
  try {
    const item = localStorage.getItem(`scrobbler_cache_${key}`);
    if (!item) return null;
    return JSON.parse(item);
  } catch {
    return null;
  }
}

function setToLocalStorage(key: string, entry: CacheEntry): void {
  try {
    localStorage.setItem(`scrobbler_cache_${key}`, JSON.stringify(entry));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}

// Tier 1: Memory-only cache (for recent tracks, now playing, scrobble count)
export function getMemoryCache<T>(key: string): T | null {
  return memoryCache.get(key) || null;
}

export function setMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, data);
}

// Tier 2: Persistent cache - synchronous read from localStorage
export function getCachedDataSync<T>(key: string): T | null {
  const now = Date.now();

  // Check persistent memory cache first
  let cached = persistentCache.get(key);

  // If not in memory, check localStorage
  if (!cached) {
    cached = getFromLocalStorage(key);
    if (cached) {
      // Restore to persistent memory cache
      persistentCache.set(key, cached);
    }
  }

  // Check if cache is still valid
  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }

  return null;
}

// Tier 2: Persistent cache - async fetch with localStorage persistence
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
): Promise<T> {
  const now = Date.now();

  // Check persistent memory cache first (fastest)
  let cached = persistentCache.get(key);

  // If not in memory, check localStorage
  if (!cached) {
    cached = getFromLocalStorage(key);
    if (cached) {
      // Restore to persistent memory cache
      persistentCache.set(key, cached);
    }
  }

  // Check if cache is still valid
  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }

  // Fetch fresh data
  const data = await fetcher();
  const entry: CacheEntry = { data, timestamp: now, ttl };

  // Store in both persistent memory cache and localStorage
  persistentCache.set(key, entry);
  setToLocalStorage(key, entry);

  return data;
}

export function clearCache() {
  memoryCache.clear();
  persistentCache.clear();
  // Clear all scrobbler cache items from localStorage
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("scrobbler_cache_")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore errors
  }
}

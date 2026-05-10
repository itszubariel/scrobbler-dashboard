const API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

async function fetchLastFM(
  method: string,
  params: Record<string, string> = {},
) {
  const url = new URL(BASE_URL);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);
  return res.json();
}

export async function getUserInfo(username: string) {
  return fetchLastFM("user.getInfo", { user: username });
}

export async function getTopArtists(
  username: string,
  period = "overall",
  limit = "10",
) {
  return fetchLastFM("user.getTopArtists", { user: username, period, limit });
}

export async function getTopAlbums(
  username: string,
  period = "overall",
  limit = "10",
) {
  return fetchLastFM("user.getTopAlbums", { user: username, period, limit });
}

export async function getTopTracks(
  username: string,
  period = "overall",
  limit = "10",
) {
  return fetchLastFM("user.getTopTracks", { user: username, period, limit });
}

export async function getRecentTracks(username: string, limit = "20", page = "1") {
  return fetchLastFM("user.getRecentTracks", { user: username, limit, page });
}

export async function getRecentTracksPaginated(
  username: string,
  limit: string,
  page: string,
) {
  return fetchLastFM("user.getRecentTracks", { user: username, limit, page });
}

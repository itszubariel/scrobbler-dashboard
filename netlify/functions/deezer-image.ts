import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  const artist = event.queryStringParameters?.artist;

  if (!artist) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing artist parameter" }),
    };
  }

  try {
    const response = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`,
    );
    const data = await response.json();

    const imageUrl = data.data?.[0]?.picture_xl || null;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
      body: JSON.stringify({ imageUrl }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch from Deezer API" }),
    };
  }
};

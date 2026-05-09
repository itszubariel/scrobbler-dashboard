export const handler = async (event) => {
  const topArtists = event.queryStringParameters?.topArtists;
  const topGenres = event.queryStringParameters?.topGenres;
  const totalScrobbles = event.queryStringParameters?.totalScrobbles;

  if (!topArtists || !totalScrobbles) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required parameters" }),
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    const artistList = topArtists.split(",").slice(0, 5).join(", ");
    const genreList = topGenres
      ? topGenres.split(",").slice(0, 3).join(", ")
      : null;

    const prompt = [
      "Write a single punchy sentence (max 100 characters) as a music personality bio.",
      `Top artists: ${artistList}.`,
      genreList ? `Genres: ${genreList}.` : null,
      "Fun and witty. No username. Just the sentence, nothing else.",
    ]
      .filter(Boolean)
      .join(" ");

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 40,
          temperature: 0.85,
        }),
      },
    );

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to generate bio" }),
      };
    }

    const data = await response.json();
    let bio = data.choices?.[0]?.message?.content?.trim() || null;

    if (!bio) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=21600",
        },
        body: JSON.stringify({ bio: "" }),
      };
    }

    // Hard cap at 150 chars, break at last space to avoid cutting mid-word
    if (bio.length > 150) {
      const truncated = bio.slice(0, 150);
      const lastSpace = truncated.lastIndexOf(" ");
      bio = (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated) + "…";
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600",
      },
      body: JSON.stringify({ bio }),
    };
  } catch (error) {
    console.error("Bio generation error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate bio" }),
    };
  }
};

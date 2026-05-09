export const handler = async (event) => {
  const artistName = event.queryStringParameters?.artistName;
  const trackName = event.queryStringParameters?.trackName;
  const albumName = event.queryStringParameters?.albumName;
  const similarTo = event.queryStringParameters?.similarTo;

  // Determine recommendation type
  let prompt = "";
  let fallbackReason = "similar sound and style.";

  if (trackName && artistName && similarTo) {
    // Track recommendation
    prompt = `Write one sentence explaining why someone who likes "${similarTo}" would enjoy "${trackName}" by ${artistName}. Mention a specific sonic or emotional quality. Keep it between 100-180 characters.`;
    fallbackReason = `similar to ${similarTo}`;
  } else if (albumName && artistName) {
    // Album recommendation
    prompt = `Write one sentence explaining why "${albumName}" by ${artistName} is worth listening to. Mention a specific sonic or emotional quality. Keep it between 100-180 characters.`;
    fallbackReason = `by ${artistName}`;
  } else if (artistName && similarTo) {
    // Artist recommendation
    prompt = `Write one sentence explaining why someone who likes ${similarTo} would enjoy ${artistName}. Mention a specific sonic or emotional quality. Keep it between 100-180 characters.`;
    fallbackReason = `similar to ${similarTo}`;
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required parameters" }),
    };
  }

  try {
    console.log("Calling Groq API with prompt:", prompt);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are a music recommendation expert. Write specific, engaging sentences about music.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      },
    );

    if (!response.ok) {
      console.error("Groq API error:", response.status, response.statusText);
      const errorText = await response.text();
      console.error("Error details:", errorText);
      throw new Error(`Groq API returned ${response.status}`);
    }

    const data = await response.json();
    console.log("Groq API response:", JSON.stringify(data, null, 2));

    let reason = data.choices?.[0]?.message?.content?.trim();

    if (!reason || reason.length < 20) {
      console.log("Reason too short or empty, using fallback:", reason);
      reason = fallbackReason;
    } else {
      // Remove quotes if present
      reason = reason.replace(/^["']|["']$/g, "");

      // Truncate if too long
      if (reason.length > 185) {
        const lastSpace = reason.lastIndexOf(" ", 182);
        reason = reason.substring(0, lastSpace > 160 ? lastSpace : 182) + "...";
      }
    }

    console.log("Final reason:", reason);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=21600", // 6 hours
      },
      body: JSON.stringify({ reason }),
    };
  } catch (error) {
    console.error("Discovery generation error:", error);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: fallbackReason }),
    };
  }
};

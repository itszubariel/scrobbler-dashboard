import { Handler } from "@netlify/functions";
import jwt from "jsonwebtoken";

export const handler: Handler = async (event) => {
  const cookies = event.headers.cookie || "";
  const sessionCookie = cookies
    .split("; ")
    .find((c) => c.startsWith("scrobbler_session="));

  if (!sessionCookie) {
    return {
      statusCode: 401,
      body: JSON.stringify({ authenticated: false }),
    };
  }

  try {
    const sessionToken = sessionCookie.split("=")[1];
    const sessionData = jwt.verify(sessionToken, process.env.JWT_SECRET!) as any;

    return {
      statusCode: 200,
      body: JSON.stringify({
        authenticated: true,
        discordId: sessionData.discordId,
        discordUsername: sessionData.discordUsername,
        lastfmUsername: sessionData.lastfmUsername,
        hasLastfm: !!sessionData.lastfmUsername,
      }),
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify({ authenticated: false, error: "Invalid or expired session" }),
    };
  }
};

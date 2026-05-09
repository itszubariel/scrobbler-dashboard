import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export const handler: Handler = async (event) => {
  const code = event.queryStringParameters?.code;

  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No authorization code provided" }),
    };
  }

  try {
    // Exchange code for Discord access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: `https://scrobbler-dashboard.netlify.app/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Discord token exchange failed:", tokenResponse.status, errorData);
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    // Get Discord user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error("Discord user fetch failed:", userResponse.status, errorData);
      throw new Error(`Failed to fetch Discord user: ${userResponse.status}`);
    }

    const discordUser = await userResponse.json();
    console.log("Discord user authenticated:", discordUser.id);

    // Check if user has linked Last.fm account in Supabase
    const { data: userData, error } = await supabase
      .from("User")
      .select("lastfmUsername, username")
      .eq("discordId", discordUser.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error("Supabase error:", error);
      throw new Error("Database query failed");
    }

    console.log("User data from Supabase:", userData ? "found" : "not found");

    // Create secure JWT session token
    const sessionData = {
      discordId: discordUser.id,
      discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
      lastfmUsername: userData?.lastfmUsername || null,
    };

    const sessionToken = jwt.sign(sessionData, process.env.JWT_SECRET!, {
      expiresIn: "30d",
    });

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `scrobbler_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`, // 30 days
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        hasLastfm: !!userData?.lastfmUsername,
        lastfmUsername: userData?.lastfmUsername || null,
        discordUsername: sessionData.discordUsername,
      }),
    };
  } catch (error) {
    console.error("Auth error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Authentication failed" }),
    };
  }
};

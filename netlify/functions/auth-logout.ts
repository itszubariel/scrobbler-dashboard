import { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Set-Cookie":
        "scrobbler_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ success: true }),
  };
};

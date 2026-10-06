import { randomUUID } from "node:crypto";
import { AccessToken, TrackSource } from "livekit-server-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const name = typeof body === "object" && body !== null && "name" in body ? body.name : undefined;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
    return Response.json({ error: "Enter a participant name between 1 and 80 characters." }, { status: 400 });
  }

  const serverUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!serverUrl || !apiKey || !apiSecret) {
    return Response.json({ error: "LiveKit is not configured on the server." }, { status: 503 });
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: randomUUID(), name: name.trim(), ttl: "10m",
    });
    token.addGrant({
      roomJoin: true, room: "games-poc", canSubscribe: true,
      canPublish: true, canPublishSources: [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE], canPublishData: false,
    });
    return Response.json({ serverUrl, token: await token.toJwt() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Could not generate a LiveKit token." }, { status: 500 });
  }
}

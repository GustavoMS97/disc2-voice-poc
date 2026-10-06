# LiveKit voice POC

Minimal Next.js App Router voice call using LiveKit Cloud. Everyone joins the fixed
room `games-poc`. Includes names, participant list, microphone mute/unmute, leave,
connection/error states, and an audio playback button if the browser blocks autoplay.
Step B adds speaking indicators for all participants and individual remote microphone
volume sliders (0–100%, default 100%). Volume affects only the current listener and
is kept while the participant remains in the call, including microphone mute/unmute
and track replacement. It resets when that participant leaves or you leave the call.
No webcam, screen sharing, chat, authentication, database, or persistence.

## Setup

1. In your LiveKit Cloud project settings, get the WebSocket URL, API key, and API secret.
2. Set these in `.env.local` (server-only; never use `NEXT_PUBLIC_` for the credentials):

   ```dotenv
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   ```

3. Install dependencies with `npm ci` if needed, then run `npm run dev`.
4. Restart the dev server after changing environment variables.

`POST /api/livekit/token` accepts JSON `{ "name": "Alice" }`. It trims and validates
names (1–80 characters), assigns a unique identity for each join, and issues a
10-minute token scoped to `games-poc`, subscription, and microphone publishing only.
The API secret stays on the server. The endpoint is intentionally unauthenticated
for this POC. No room creation step is needed: LiveKit creates it on first join.

## Test in two browsers on one computer

1. Open `http://localhost:3000` in Chrome and Firefox (or two separate browser profiles).
2. Enter `Alice` in one and `Bob` in the other. Click **Join call** in each and allow microphone access.
3. Confirm both pages show connection `connected` and both names in the participant list.
4. If **Enable call audio** appears, click it.
5. Mute Bob while checking that Alice's microphone audio reaches Bob, then reverse the roles.
   Use headphones to reduce feedback; two clients using the same microphone on one
   computer are less useful for verifying real bidirectional conversation.
6. Click **Mute microphone**: the other browser should stop hearing that participant.
   Click **Unmute microphone** and confirm audio returns.
7. Click **Leave call**. The other participant's list should update, and the leaving
   browser should release its microphone. Join again to verify recovery.
8. Deny microphone permission in a browser to verify the error state. Restore permission
   in site settings and join again. Temporarily disable networking to observe reconnecting
   or disconnected states, then restore it.

## Test on two computers

Choose either:

- Run this project on **each computer** with the same LiveKit Cloud project credentials.
  Open `http://localhost:3000` locally on each. Both instances generate tokens for the
  same Cloud room, so they can call each other without exposing the Next.js dev server.
- Serve a single instance over **HTTPS**, set the three server environment variables,
  and open its HTTPS URL on both computers.

Plain `http://<LAN-IP>:3000` is insufficient for microphone access: browsers require
a secure context (HTTPS or localhost). With headphones on each computer, follow the
Alice/Bob steps above and verify a conversation in both directions. Camera permission
should never be requested. Both computers need internet access to LiveKit Cloud.

## Test speaking indicators and individual volume (step B)

1. Join from two browsers/computers with headphones using the steps above.
2. Speak in each: the corresponding participant should show a green **Speaking**
   badge on both pages, returning to **Not speaking** after silence. Mute the
   microphone and confirm it stops indicating speech.
3. On Alice's page, set Bob's microphone volume to 50%, then 0%, then 100% while Bob
   speaks. Alice should hear quieter audio, silence, then normal audio. Bob's
   microphone remains enabled and his speaking indicator still works at 0%.
4. Confirm Alice has no slider for her own microphone. Bob's slider for Alice is
   independent of Alice's setting for Bob.
5. Set Bob to 25% on Alice's page, then mute/unmute Bob's microphone. The slider
   should stay at 25% and audio should resume at that level.
6. Optionally join a third browser as Charlie: changing Bob's volume on Alice's
   page must leave Charlie's audio unchanged.
7. Leave and rejoin to check participant cleanup and default volume restoration.
   Recheck join, mute/unmute, leave, and **Enable call audio** if it appears.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

SDK references: [LiveKit client](https://docs.livekit.io/reference/client-sdk-js/)
and [LiveKit server tokens](https://docs.livekit.io/reference/server-sdk-js/).

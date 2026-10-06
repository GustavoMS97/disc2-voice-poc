# LiveKit voice POC

Minimal Next.js App Router voice call using LiveKit Cloud. Everyone joins the fixed
room `games-poc`. Includes names, participant list, microphone mute/unmute, leave,
connection/error states, and an audio playback button if the browser blocks autoplay.
Step B adds speaking indicators for all participants and individual remote microphone
volume sliders (0–100%, default 100%). Volume affects only the current listener and
is kept while the participant remains in the call, including microphone mute/unmute
and track replacement. It resets when that participant leaves or you leave the call.
Basic screen sharing uses the browser's native picker, targets 1280×720 at 30 FPS,
and automatically displays each shared screen with its participant's name.
No webcam, screen/system audio, chat, authentication, database, or persistence.

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
10-minute token scoped to `games-poc`, subscription, and microphone/screen-video publishing only.
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

## Test screen sharing on two Windows + Chrome computers

1. Deploy this version to Vercel. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
   `LIVEKIT_API_SECRET` for the deployment's Production or Preview environment,
   and redeploy after environment changes. Open the same HTTPS deployment URL
   in Chrome on both Windows computers. Both need internet access.
2. Leave any existing calls and rejoin as Alice and Bob to get new tokens with
   screen-video publishing permission. Allow microphone access and use headphones.
3. On Alice's computer, click **Share screen**. In Chrome's native picker choose
   a tab, window, or entire screen, then click **Share**. Choosing a different tab
   or a window such as Notepad avoids a recursive preview of the call page.
4. Confirm both computers show **Alice is sharing** and the screen video. Type or
   scroll in the shared source and confirm Bob sees the updates. Alice should now
   have a **Stop sharing** button. No webcam permission should be requested.
5. Continue speaking, mute/unmute, and change microphone volume while sharing.
   Voice, speaking indicators, and volume controls should continue working.
   Screen/system audio is not captured or published.
6. Click the app's **Stop sharing** on Alice. The video should disappear on both
   computers and the button should return to **Share screen**.
7. Start another share, then use Chrome's native **Stop sharing** control. Verify
   the same cleanup and button reset, then start sharing again.
8. Open the picker and click **Cancel**. The call should stay connected with no
   new screen video, a brief cancellation/permission message, and an enabled
   **Share screen** button for retrying.
9. Share from Bob instead. You can also share from both computers simultaneously:
   each participant can publish one local screen, and both named videos appear.
10. Leave while sharing: the other computer should lose that participant's screen
    and participant entry. Rejoin to confirm microphone and screen sharing work again.

1280×720 at 30 FPS is a capture/encoding target, not a guarantee. The selected
surface's aspect ratio, browser, available bandwidth, and encoder can affect
actual resolution and delivered frame rate.

### Track handling notes for the next step

- Screen video has source `ScreenShare`, separate from `Microphone`. Screen audio
  would be a separate `ScreenShareAudio` publication; it is disabled in capture
  and excluded from token permissions here.
- The SDK's `setScreenShareEnabled(false)` unpublishes and stops the screen track;
  unlike microphone mute, it does not retain a muted screen publication.
- The SDK also unpublishes screen tracks when the browser's capture track ends.
  LiveKit React hooks update the button and video list from publication events.
- A new sharing session has a new track SID. Videos are keyed by publication SID,
  and sharer names come from the participant associated with each track reference.
- Remote tracks are currently automatically subscribed. A future **Watch** flow
  will need to list publications independently of subscription and explicitly
  control subscription/rendering.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

SDK references: [LiveKit client](https://docs.livekit.io/reference/client-sdk-js/)
and [LiveKit server tokens](https://docs.livekit.io/reference/server-sdk-js/).

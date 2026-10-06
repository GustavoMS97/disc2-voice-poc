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
Screen sharing requests optional browser audio and publishes it as a separate
`ScreenShareAudio` track. Participant rows show microphone, screen video, and
screen audio publication status with their track SIDs. Microphone sliders affect
only microphone playback. A separate screen-audio slider (0–100%, default 100%)
appears for each remote participant with a subscribed screen-audio track and affects
only that track. It disappears when the track is removed and resets for a new share.
Volume preferences are not persisted.
No webcam, chat, authentication, database, or persistence.

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
10-minute token scoped to `games-poc`, subscription, and microphone/screen-video/screen-audio publishing only.
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
   Screen/system audio is optional; see the audio validation steps below.
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
  is a separate `ScreenShareAudio` publication when the browser supplies audio.
- The SDK's `setScreenShareEnabled(false)` unpublishes and stops the screen track;
  unlike microphone mute, it does not retain a muted screen publication.
- The SDK also unpublishes screen tracks when the browser's capture track ends.
  LiveKit React hooks update the button and video list from publication events.
  The installed SDK handles ended tracks individually. The app additionally stops
  and unpublishes associated screen audio when screen video is unpublished, including
  when video ends during concurrent publication of the two screen tracks.
- A new sharing session has a new track SID. Videos are keyed by publication SID,
  and sharer names come from the participant associated with each track reference.
- Remote tracks are currently automatically subscribed. A future **Watch** flow
  will need to list publications independently of subscription and explicitly
  control subscription/rendering.

## Validate screen/system audio on two Windows + Chrome computers

1. Deploy this version and open the same HTTPS URL in current desktop Chrome on
   both Windows computers. Leave/rejoin as Alice and Bob to get tokens permitting
   `screen_share_audio`. Use headphones on both computers.
2. First test **Chrome Tab**: play a video or music in another tab on Alice's
   computer, click **Share screen**, choose that tab, enable **Share tab audio**
   (wording may vary), and share. Bob should see the video and hear its audio.
   Click **Enable call audio** on Bob if it appears.
3. In Alice's row on Bob's computer, confirm **Microphone audio**, **Screen-share
   video**, and **Screen-share audio** are published with three different SIDs.
   Status indicates publication/mute state, not that the source is producing sound.
4. Have Alice talk while the shared tab plays. On Bob's computer, set Alice's
   microphone slider to 0%: Alice's voice should disappear but tab audio should
   continue. Restore the slider. Alice then mutes her microphone: share audio
   must still continue, and only the microphone status should say **Muted**.
5. Stop sharing. Screen video and screen audio must disappear from the UI and
   playback must stop, while microphone audio remains available. Repeat using
   Chrome's native **Stop sharing**, then share again to verify recovery.
6. **Game/application system-audio test:** on Alice's Windows computer, run a game
   in windowed/borderless mode or play audio in a desktop media application. Share
   **Entire Screen**, selecting the display with that application, and enable
   **Share system audio** / **Also share system audio** if Chrome offers it. Keep
   Alice's microphone muted and confirm Bob sees the game/application and hears
   its audio. This isolates the captured system audio from microphone pickup.
7. Repeat with the game's **Window** if desired. Audio options differ with browser
   version and platform; use Entire Screen as the baseline for system audio.
   Requesting audio does not force Chrome to return an audio track.
8. Share with the picker audio checkbox disabled (or a surface without audio
   support). Video must still work. The participant row should show **No audio
   track provided by the browser** instead of treating the share as a failure.
9. Cancel the picker, leave while sharing, and rejoin. Confirm cancellation keeps
   the voice call connected, leaving removes both share tracks, and microphone
   controls and speaking indicators still work.

System capture can include the call's own received audio as well as other
applications. For the game validation, keep Bob's microphone muted while Alice
shares to avoid recapturing Bob's voice. This POC does not filter or mix sources.
No local screen-audio playback element is created, avoiding direct self-monitoring.

To confirm separation, compare the different track SIDs shown in the participant
row and run the microphone-slider/mute tests above. You can also inspect the
participant's publications in the LiveKit Cloud room view: sources should be
`microphone`, `screen_share`, and `screen_share_audio`. A SID identifies a LiveKit
publication; sharing again creates new screen publication SIDs.

Browser references: [Chrome capture controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls)
and [getDisplayMedia audio limitations](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia).

## Validate independent microphone and screen-audio volume

1. Deploy this version and join the same HTTPS URL from two Windows + Chrome
   computers as Alice and Bob, with headphones. Keep Bob's microphone muted
   during system capture to avoid recapturing his voice.
2. Alice starts YouTube or a game and shares with tab/system audio enabled.
   On Bob's page, Alice's row should show separate **Microphone volume** and
   **Screen audio volume** sliders, both initially 100%.
3. Alice unmutes her microphone and speaks while the media plays. On Bob's page,
   move **Microphone volume** to 0%: voice should disappear, shared media should
   continue, and the screen slider should stay at 100%. Restore microphone to 80%.
4. Move **Screen audio volume** to 0%: media should disappear, Alice's voice should
   continue, the microphone slider should stay at 80%, and video should continue.
   Set screen audio to 40% and compare with 100%; only media loudness should change.
5. Alice mutes her microphone, matching the earlier validated YouTube scenario.
   Bob should still hear media and be able to adjust it with the screen slider.
6. Stop sharing using either the app or Chrome's native control. The screen slider
   and video should disappear while microphone volume remains at 80%. Start a
   new share with audio: screen volume should default to 100% again.
7. Share without audio: no screen-audio slider should appear. Local participant
   rows should never show either remote playback slider. Recheck mute/unmute,
   speaking indicators, and leaving the call.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

SDK references: [LiveKit client](https://docs.livekit.io/reference/client-sdk-js/)
and [LiveKit server tokens](https://docs.livekit.io/reference/server-sdk-js/).

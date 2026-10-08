# LiveKit voice POC

For the final 3–5-person game-sharing validation, follow [TESTING.md](./TESTING.md).
The removable **Call diagnostics** panel is read-only, event-driven, and keeps only
the last five reconnect events in browser memory. It does not measure latency or
collect/store telemetry.

Minimal Next.js App Router voice call using LiveKit Cloud. Everyone joins the fixed
room `games-poc`. Includes names, participant list, microphone mute/unmute, leave,
connection/error states, and an explicit playback-resume button.
Step B adds speaking indicators for all participants and individual remote microphone
volume sliders (0–100%, default 100%). Volume affects only the current listener and
is kept while the participant remains in the call, including microphone mute/unmute
and track replacement. It resets when that participant leaves or you leave the call.
Basic screen sharing uses the browser's native picker, targets 1280×720 at 30 FPS,
and lists available shared screens with each participant's name. Remote video/audio
are only subscribed and rendered after **Watch**. **Stop watching** unsubscribes
both screen sources without leaving the voice call. Local preview remains automatic.
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
   ALLOWED_EMAILS=email1@gmail.com,email2@gmail.com
   ```

3. Install dependencies with `npm ci` if needed, then run `npm run dev`.
4. Restart the dev server after changing environment variables.

The first form checks the email against the server-only `ALLOWED_EMAILS` list.
Matching ignores surrounding whitespace and letter case; only exact addresses
are allowed. An unset/empty list blocks all joins. Add this variable to Vercel's
Production/Preview environment and redeploy; restart local dev after changing it.
The actual `.env.local` is not changed by this implementation.

This is a simple admission gate, **not email ownership verification**: anyone who
knows an allowed email can enter it. The allowlist is never returned to the browser.
No email is added to LiveKit participant names/metadata or persisted by the app.

`POST /api/livekit/token` accepts JSON `{ "name": "Alice", "email": "email1@gmail.com" }`. It rechecks email access on every token request, then trims and validates
names (1–80 characters), assigns a unique identity for each join, and issues a
10-minute token scoped to `games-poc`, subscription, and microphone/screen-video/screen-audio publishing only.
The API secret stays on the server. No room creation step is needed: LiveKit creates
it on first join. Removing an email blocks new tokens after configuration is
deployed; it does not disconnect existing participants or revoke already issued tokens.

## Test in two browsers on one computer

1. Open `http://localhost:3000` in Chrome and Firefox (or two separate browser profiles).
2. Enter `Alice` in one and `Bob` in the other. Click **Join call** in each and allow microphone access.
3. Confirm both pages show connection `connected` and both names in the participant list.
4. Tap **Enable / resume call playback** if audio/video is blocked or paused.
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
   Recheck join, mute/unmute, leave, and **Enable / resume call playback**.

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
4. Bob clicks **Watch**. Confirm both computers show **Alice is sharing** and the screen video. Type or
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
- Room connection uses `autoSubscribe: false`. Microphones are explicitly subscribed
  for existing/new participants and after reconnect. Screen publications remain
  visible as metadata without a media subscription; **Watch** subscribes video and
  optional audio per track, including audio published after viewing begins.
- Viewing state is keyed by screen-video SID. Removing that publication unmounts
  the viewer and unsubscribes associated audio; a new share requires another click.

## Validate screen/system audio on two Windows + Chrome computers

1. Deploy this version and open the same HTTPS URL in current desktop Chrome on
   both Windows computers. Leave/rejoin as Alice and Bob to get tokens permitting
   `screen_share_audio`. Use headphones on both computers.
2. First test **Chrome Tab**: play a video or music in another tab on Alice's
   computer, click **Share screen**, choose that tab, enable **Share tab audio**
   (wording may vary), and share. Bob clicks **Watch** to see video and hear audio.
   Click **Enable / resume call playback** on Bob if needed.
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
   On Bob's page, click **Watch** for Alice's share. Her participant row has
   **Microphone volume** and the screen viewer has **Screen audio volume**,
   both initially 100%.
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

## Validate selective screen-share subscription

1. Deploy this version and reload/rejoin both Windows + Chrome computers as
   Alice and Bob. Use headphones. Keep a conversation going throughout the test.
2. Alice shares a tab playing media with tab audio enabled. Bob should see
   **Alice is sharing their screen**, **Watch**, and **not subscribed** for both
   screen video and audio. No remote screen video or screen audio should play.
   Alice's microphone should still be audible and its volume slider should work.
3. On Bob's Chrome, open `chrome://webrtc-internals` before joining. Inspect the
   receiving peer connection's inbound RTP stats while Alice shares. Before
   Watch there should be no active inbound screen-video/audio media receiving
   bytes. Microphone audio can receive bytes normally. Aggregate connection traffic
   alone is insufficient because signaling, microphone media, and RTCP still flow.
4. Click **Watch**. Both screen subscription statuses should become **subscribed**;
   video, media audio, and screen-audio volume should appear. The inbound video
   and second audio RTP streams should now have increasing `bytesReceived`.
   Screen track SIDs are shown in Alice's participant row; SID values may differ
   from browser RTP identifiers, so compare stats before/after as well.
5. Adjust microphone and screen-audio volumes independently while Alice talks and
   plays media. Click **Stop watching**: video and screen-audio controls disappear,
   screen media stops, and screen subscriptions become **not subscribed**. After
   a short signaling delay their RTP byte counters stop increasing (or stats
   entries disappear). Microphone remains audible; connection stays `connected`,
   names remain listed, and mute/unmute continues to work. Watch again to resume.
6. Stop Alice's share while Bob watches. The viewer should disappear. Start a new
   share: Bob must click **Watch** again. Repeat using Chrome's native Stop sharing.
7. Share without audio: Bob can still watch video; UI shows no screen audio and
   no screen-audio slider. Join Bob after Alice is already sharing: microphone
   should work immediately, but screen tracks must still wait for **Watch**.
8. Optionally add Charlie: Bob watching must not subscribe Charlie. Each listener
   chooses independently. Temporarily interrupt networking and restore it to
   verify microphone recovery and that unwatched shares remain unsubscribed.

Subscription-status text reports SDK track attachment, not a packet capture.
Use per-stream RTP stats for network verification. Screen-audio volume resets
to 100% after Stop watching/Watch; microphone volume remains unchanged.

## iPhone/mobile POC checklist

Deploy this version to Vercel, open the same HTTPS URL on a Windows + Chrome
sharer and an iPhone browser, and reload/rejoin. Record the iPhone model, iOS
version, browser, battery/Low Power Mode, and audio output (speaker/headphones).
Test Safari first, then another browser if useful. This has not been validated
on a physical iPhone by automated checks.

### Expected application behavior

1. Join on the iPhone with a long participant name. Allow microphone access.
   There should be no horizontal overflow, clipped labels, or input-focus zoom.
   Buttons and sliders should be usable by touch. Confirm connected participants,
   speaking indicators, mute/unmute, and bidirectional microphone audio.
2. Adjust a remote microphone slider from 100% to 40% to 0% and back. Only that
   participant's microphone should change. LiveKit's built-in Web Audio playback
   is enabled so iOS uses per-track gain nodes rather than element-volume controls.
   Tracks remain separate; no custom mixer or master volume is introduced.
3. Start sharing on Windows with YouTube/game audio. On iPhone, verify availability
   appears without screen playback, then tap **Watch**. Confirm inline video/audio.
   Tap **Enable / resume call playback** if the browser blocks or pauses playback.
4. Adjust **Screen audio volume** independently from microphone volume. Test both
   0%/100% combinations while the sharer speaks and media plays. Keep the iPhone
   microphone muted during system capture if needed to avoid recapturing its voice.
5. Rotate portrait → landscape → portrait while watching. Video should remain
   contained within the viewport and preserve its content aspect ratio. Controls
   remain reachable by scrolling. No Picture-in-Picture action is provided.
6. Tap **Fullscreen**. Supported browsers enter fullscreen from this gesture.
   Safari may use native video fullscreen with its own controls rather than the
   page's controls. Exit via browser/native controls to reach volume/Stop watching.
   If unavailable/rejected, a message should appear and inline viewing should continue.
7. Tap **Stop watching**. Screen video/audio unsubscribe; microphone audio, mute,
   volume, and room connection continue. Re-watch and test the sharer stopping.
8. Observe **Connection**, **Page**, **Hidden transitions**, and **Wake lock**.
   When supported/permitted, visible active calls should show wake lock **active**.
   With a short device auto-lock setting, leave the visible call idle to check
   whether the screen remains awake. Unsupported/denied locks must not prevent calls.
9. Tap **Leave call**. Microphone/media should stop and wake lock should be released;
   debug panel should show **inactive** and **disconnected**. Join again to check recovery.

### Browser/OS behavior to observe, not guarantees from the app

- Switch to another app for 10–30 seconds, then return. Check the hidden-transition
  count, LiveKit state, whether voice/screen playback continued remotely, and whether
  wake lock becomes active again. Retry with about a minute in the background.
- Manually lock the iPhone, wait, unlock, and return to the browser. Record whether
  the room stayed connected, reconnected, or disconnected, and whether microphone
  capture and each remote audio/video stream resume. Use the explicit playback
  button if needed; if disconnected, the normal join form lets you rejoin.
- Wake lock only applies to an active visible document. It cannot prevent manual
  locking or guarantee background execution. The browser can revoke or deny it,
  including because of power settings; returning visible triggers a fresh request.
- iOS may suspend the page, its AudioContext, capture, playback, or networking in
  the background. The debug panel displays the last state JavaScript observed; it
  cannot update while the OS suspends execution. No background workaround is used.
- Native video fullscreen and autoplay permissions vary by iOS/browser version.
  Fullscreen may show only video/native controls; microphone and screen audio are
  separate playback tracks, so verify audio continues rather than assuming it.

References: [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API),
[Safari video fullscreen](https://developer.apple.com/documentation/webkitjs/htmlvideoelement/1633500-webkitenterfullscreen),
[Page Visibility](https://developer.mozilla.org/en-US/blog/using-the-page-visibility-api/).

## Audio input/output devices

While connected, expand **Audio devices** beside the call controls. **Microphone**
lists browser-exposed audio inputs and switches the LiveKit microphone in place,
preserving mute state. **Output** changes only this app's playback destination,
including remote microphones and subscribed screen-share audio; Windows defaults
are unchanged. LiveKit's shared Web Audio context retains independent track gains.
The SDK also updates output settings for current/future remote tracks.

Successful choices are stored as `games-poc.audioinput` / `games-poc.audiooutput`
in localStorage for this browser/origin. On joining again, the app tries restoring
them after microphone permission/publication; a missing or rejected saved device
falls back to system default. Device IDs can change after browser permission/data
resets. Storage denial is harmless. Unplugging a selected device triggers a default
fallback; if no working default exists, select another device and check permissions.

Output selection requires HTTPS and Web Audio `AudioContext.setSinkId` support
(current Windows Chrome is the main target). Unsupported browsers, including some
mobile/Safari versions, show a disabled output selector and retain system routing.
Only devices exposed by browser permissions are listed. Grant microphone permission
and check site/OS permissions if labels or outputs are missing. Device selection
does not change system-audio capture: the screen picker still controls that source.

### Windows + Chrome manual checklist

1. Join with another participant and expand **Audio devices**.
2. Switch between two microphone inputs without leaving. Speak/tap each microphone;
   the remote participant should hear only the selected one. Confirm the selector's
   label, speaking indicator, mute/unmute, and participant list remain correct.
3. Mute, switch microphone, then unmute. Switching must not silently unmute you.
4. Switch between two outputs (for example Sonar Gaming/Chat or headphones/speakers).
   Remote voice should move to the selected output. Windows global/default output
   must remain unchanged. Select **System default** to return to browser routing.
5. Have the other participant share media/game with system audio; tap **Watch**.
   Both voice and screen audio should use the selected output. Switch output again
   while both play. Stop watching/re-watch and verify newly attached audio routes
   correctly too.
6. Test both independent volume sliders after switching: mic 0% / screen 100%,
   then mic 100% / screen 0%. Only the selected source should become silent.
7. Disconnect/reconnect the selected physical device. Check updated dropdowns and
   default fallback/error message. Call remains connected; choose the device again
   if desired. Virtual Sonar devices may remain enumerated when a headset is unplugged.
8. Choose nondefault devices, leave, reload, and rejoin. When the IDs still exist,
   both selections should restore. Repeat with a saved device missing: defaults
   should work. Check mobile voice/viewing and unsupported-output messaging.

Browser API reference: [AudioContext.setSinkId](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId).

## Checks

```bash
npm run lint
npx tsc --noEmit
node scripts/check-screen-discovery.mjs
node scripts/check-call-environment.mjs
node scripts/check-call-diagnostics.mjs
node scripts/check-email-access.mjs
node scripts/check-audio-devices.mjs
npm run build
```

SDK references: [LiveKit client](https://docs.livekit.io/reference/client-sdk-js/)
and [LiveKit server tokens](https://docs.livekit.io/reference/server-sdk-js/).

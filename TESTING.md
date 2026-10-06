# Final group validation: 3–5 participants

This is a manual validation plan, not measured performance results.

## Preparation

- Plan 45–60 minutes with 3–5 people, headphones, and unique names. Include an
  iPhone/mobile browser if available. Use the same deployed Vercel HTTPS URL and
  LiveKit project (`games-poc`); reload everyone onto the same version.
- Choose one Windows + Chrome game sharer and one note taker. Run Valorant in a
  practice session, preferably windowed/borderless. Close other audio sources.
- Configure each tester's email in server-side `ALLOWED_EMAILS`, redeploy, and
  enter an allowed email before joining. This gate does not verify email ownership.
- Record start time, deployment/version, device/browser versions, and networks.
  Note LiveKit Cloud project usage totals/time range before starting. Avoid other
  sessions on that project while comparing usage; dashboard totals may update later.
- Keep the local **Call diagnostics** panel visible for state/quality/reconnect
  observations. Page visibility and wake lock are in the existing browser panel.
  Quality is an SDK estimate, not measured latency; user agent is browser-reported.

## Session

1. **Join and voice, 5–10 min:** everyone joins. Check matching names/counts and
   `connected`. Hold normal conversation, then have 2–3 people deliberately speak
   over each other. Check speaking indicators, clipping, echo, delays and dropouts.
   Each person mutes/unmutes; others confirm silence/resumption. Adjust one remote
   microphone to 40%, 0%, 100%; verify other microphones remain unchanged.
2. **Game share, 10 min:** share Valorant at the existing 720p30 target. For system
   audio, select Entire Screen and enable Chrome's system-audio checkbox. If testing
   Window capture, record whether audio is offered. First mute the sharer's mic:
   watchers must still hear game sounds. Check video/audio publication states.
3. **Selective viewing:** have 1–2 people Watch and at least one remain unwatched.
   Unwatched clients should show available publications but **not subscribed**, no
   video/game playback; voice still works. Watchers should see both subscribed
   screen tracks (when audio is available). Optionally compare per-stream inbound
   RTP `bytesReceived` in `chrome://webrtc-internals`, opened before joining.
4. **Independent audio:** unmute the sharer and talk over game sounds. Each watcher
   sets microphone 0% / game 100%, then microphone 100% / game 0%, then 80% / 40%.
   Verify only the selected source changes. Keep the other participants muted during
   this part if system capture recaptures received call audio.
5. **Viewing/share transitions, 5–10 min:** cycle Watch/Stop watching several times,
   changing viewer count from zero to all remote participants. Voice must continue.
   Stop/restart the share using the app and Chrome-native Stop sharing. New shares
   require Watch again; stale video/audio must disappear. Test video-only sharing
   once, then restore audio. Record approximate viewer counts and sharing intervals.
6. **Recovery, 5 min:** one non-sharer disables network for 15–30 seconds, then restores
   it. Observe room state, quality and signal/media reconnect events on that client;
   note time to usable voice/video, whether Watch needs repeating, and any failure.
   If disconnected, manually rejoin and record that recovery was not automatic.
   Another participant leaves/rejoins; verify counts, names and microphone cleanup.
7. **Mobile, if available:** test voice and independent volume, Watch/Stop watching,
   portrait/landscape, fullscreen/fallback, and wake lock. Switch apps for 20–60
   seconds and lock/unlock once; record connection/playback on return. Use the
   playback-resume button if necessary. Background suspension is an OS/browser
   observation, not a guarantee this app keeps running.
8. **Stability:** continue realistic conversation and game viewing until the session
   reaches 45–60 minutes. Note timestamps/device/viewing state for every issue.
   At the end, stop sharing and have everyone leave. Check usage again after the
   Cloud dashboard updates, using matching project/time range and units.

## Manual record

| Field | Observation |
| --- | --- |
| Date, start/end time, deployment/version | |
| Devices, browsers, networks | |
| Test duration | |
| Average participant count (time-weighted estimate) | |
| Approximate screen-sharing active time | |
| Approximate screen viewers (typical/range; exclude sharer) | |
| Perceived voice latency (subjective; device/context) | |
| Perceived screen-share latency (subjective; device/context) | |
| Audio issues (time, source, listener, volume/mute state) | |
| Video issues (time, viewer, freeze/quality/latency) | |
| Reconnection issues/events and recovery time | |
| Mobile issues (visibility/wake lock/fullscreen/playback) | |
| LiveKit Cloud participant minutes used: before / after / delta | |
| LiveKit Cloud downstream data used: before / after / delta + unit | |
| Cloud project/time range and dashboard update time | |
| Other project activity affecting usage attribution | |
| Overall outcome and follow-up defects | |

Use Cloud-reported usage deltas, not client quality labels, to record consumption.
If totals cannot be isolated from other activity, mark attribution as uncertain.
Record latency as perceived unless separately measured; do not present estimates
as benchmark results. Event history is capped at five entries and resets on reload.

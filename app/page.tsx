"use client";

import { useEffect, useRef, useState } from "react";
import { AudioTrack, VideoTrack, RoomContext, useConnectionState, useIsSpeaking, useLocalParticipant, useParticipantAttribute, useParticipants, useTracks, type TrackReference } from "@livekit/components-react";
import { enterVideoFullscreen, observeCallEnvironment, type CallEnvironmentStatus } from "./lib/call-environment";
import { AVATAR_IDS, DEFAULT_AVATAR, avatarPixels, isAvatarId } from "./lib/avatars";
import { HeadphoneOff, Headphones, LogOut, Mic, MicOff, Monitor, MonitorOff, MonitorUp } from "lucide-react";
import CallDiagnostics from "./call-diagnostics";
import PixelAvatar from "./pixel-avatar";
import AudioDeviceControls from "./audio-device-controls";
import { createAudioRoom, closeAudioDeviceContext } from "./lib/audio-devices";
import { ConnectionState, ParticipantEvent, RemoteTrackPublication, Room, RoomEvent, ScreenSharePresets, Track, createLocalAudioTrack, type LocalAudioTrack, type LocalTrackPublication, type Participant } from "livekit-client";

function subscribeMicrophones(room: Room) {
  function subscribe(publication: RemoteTrackPublication) {
    if (publication.source === Track.Source.Microphone) publication.setSubscribed(true);
  }
  function subscribeExisting() {
    room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach(subscribe));
  }
  room.on(RoomEvent.TrackPublished, subscribe);
  room.on(RoomEvent.ParticipantConnected, subscribeExisting);
  room.on(RoomEvent.Reconnected, subscribeExisting);
  room.on(RoomEvent.Connected, subscribeExisting);
  return subscribeExisting;
}

function RemoteScreenShare({ video, audio, connected, deafened, room }: {
  video: TrackReference;
  audio?: TrackReference;
  connected: boolean;
  deafened: boolean;
  room: Room;
}) {
  const [watching, setWatching] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const videoElement = useRef<HTMLVideoElement>(null);
  const videoPublication = video.publication;
  const audioPublication = audio?.publication;

  useEffect(() => {
    if (!(videoPublication instanceof RemoteTrackPublication)) return;
    videoPublication.setSubscribed(watching);
    return () => videoPublication.setSubscribed(false);
  }, [videoPublication, watching]);

  // Audio may be published after video; apply the current viewing choice to it too.
  useEffect(() => {
    if (!(audioPublication instanceof RemoteTrackPublication)) return;
    audioPublication.setSubscribed(watching);
    return () => audioPublication.setSubscribed(false);
  }, [audioPublication, watching]);

  return (
    <figure className="card space-y-3">
      <figcaption><strong>{video.participant.name || video.participant.identity}</strong> is sharing their screen</figcaption>
      <button className={watching ? undefined : "btn-primary"} disabled={!connected} onClick={() => {
        if (!watching) void room.startAudio().catch(() => {});
        setFullscreenMessage("");
        setWatching(!watching);
      }}>
        {watching ? "Stop watching" : "Watch"}
      </button>
      {watching && (
        <>
          {videoPublication.isSubscribed ? (
            <>
              <VideoTrack ref={videoElement} trackRef={video} manageSubscription={false} className="screen-video" muted playsInline disablePictureInPicture />
              <button onClick={async () => {
                setFullscreenMessage("");
                try {
                  if (!videoElement.current) return;
                  await enterVideoFullscreen(videoElement.current);
                } catch (cause) {
                  setFullscreenMessage(cause instanceof Error ? cause.message : "Fullscreen could not start. Continue watching inline.");
                }
              }}>Fullscreen</button>
              {fullscreenMessage && <p role="status" className="text-sm">{fullscreenMessage}</p>}
            </>
          ) : <p>Waiting for screen video subscription…</p>}
          {audio && audioPublication?.isSubscribed && (
            <ScreenAudioControl key={audioPublication.trackSid} trackRef={audio} deafened={deafened} />
          )}
        </>
      )}
    </figure>
  );
}

function ScreenAudioControl({ trackRef, deafened }: { trackRef: TrackReference; deafened: boolean }) {
  const [volume, setVolume] = useState(100);

  return (
    <>
      <label className="flex flex-wrap items-center gap-3">
        <span>Screen audio volume: {volume}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          aria-label={`Screen audio volume for ${trackRef.participant.name || trackRef.participant.identity}`}
          aria-valuetext={`${volume}%`}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>
      <AudioTrack trackRef={trackRef} volume={deafened ? 0 : volume / 100} />
    </>
  );
}

function ParticipantRow({ participant, microphoneTracks, shareTracks, deafened }: {
  participant: Participant;
  microphoneTracks: TrackReference[];
  shareTracks: TrackReference[];
  deafened: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const avatar = useParticipantAttribute("avatar", { participant });
  const [volume, setVolume] = useState(100);
  const screenVideo = shareTracks.find((ref) => ref.source === Track.Source.ScreenShare);
  const microphoneMuted = !microphoneTracks.some((ref) => !ref.publication.isMuted);

  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className={`avatar ${isSpeaking ? "avatar-speaking" : ""}`}>
          <PixelAvatar id={isAvatarId(avatar) ? avatar : DEFAULT_AVATAR} size={32} />
        </span>
        <span className="font-medium">{participant.name || participant.identity}{participant.isLocal ? " (you)" : ""}</span>
        <span className="ml-auto flex items-center gap-2">
          {screenVideo && <span className="status-icon status-live" title="Sharing screen"><Monitor size={16} aria-hidden="true" /><span className="sr-only">Sharing screen</span></span>}
          {participant.isLocal && deafened && <span className="status-icon status-off" title="Deafened"><HeadphoneOff size={16} aria-hidden="true" /><span className="sr-only">Deafened</span></span>}
          {microphoneMuted && <span className="status-icon status-off" title="Microphone muted"><MicOff size={16} aria-hidden="true" /><span className="sr-only">Microphone muted</span></span>}
          <span className="sr-only">{isSpeaking ? "Speaking" : "Not speaking"}</span>
        </span>
      </div>
      {!participant.isLocal && (
        <>
          <label className="flex flex-wrap items-center gap-3">
            <span>Microphone volume: {volume}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              aria-label={`Microphone volume for ${participant.name || participant.identity}`}
              aria-valuetext={`${volume}%`}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
          {microphoneTracks.filter((ref) => ref.publication.isSubscribed).map((trackRef) => (
            <AudioTrack key={trackRef.publication.trackSid} trackRef={trackRef} volume={deafened ? 0 : volume / 100} />
          ))}
        </>
      )}
    </li>
  );
}

function Call({ room, leave }: { room: Room; leave: () => Promise<void> }) {
  const connection = useConnectionState();
  const participants = useParticipants();
  const microphoneTracks = useTracks([Track.Source.Microphone], { onlySubscribed: false });
  // Availability must include publications with no media subscription yet.
  const shareTracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio], { onlySubscribed: false });
  const screenTracks = shareTracks.filter((ref) => ref.source === Track.Source.ScreenShare);
  const { isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenMessage, setScreenMessage] = useState("");
  const [deafened, setDeafened] = useState(false);
  const microphoneBeforeDeafen = useRef(false);
  const screenPending = useRef(false);

  useEffect(() => {
    const local = room.localParticipant;
    // Native Stop sharing may end video before audio. Never leave orphan share audio.
    function stopOrphanAudio() {
      if (local.getTrackPublication(Track.Source.ScreenShare)) return;
      const audio = local.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
      if (audio) {
        audio.stop();
        void local.unpublishTrack(audio).catch(() => {
          setScreenMessage("Could not remove screen-share audio. Leave the call to finish cleanup.");
        });
      }
    }
    function onUnpublished(publication: LocalTrackPublication) {
      if (publication.source === Track.Source.ScreenShare) stopOrphanAudio();
    }
    local.on(ParticipantEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      local.off(ParticipantEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room]);

  async function toggleScreenShare() {
    if (screenPending.current || room.state !== ConnectionState.Connected) return;
    screenPending.current = true;
    setScreenBusy(true);
    setScreenMessage("");
    const starting = !room.localParticipant.isScreenShareEnabled;
    try {
      if (starting && !navigator.mediaDevices?.getDisplayMedia) {
        setScreenMessage("Screen sharing requires HTTPS or localhost and a supported browser.");
        return;
      }
      await room.localParticipant.setScreenShareEnabled(starting, {
        audio: true,
        systemAudio: "include",
        resolution: ScreenSharePresets.h720fps30.resolution,
      }, {
        screenShareEncoding: ScreenSharePresets.h720fps30.encoding,
      });
      // Video and audio publish concurrently; the browser can end video mid-publication.
      if (!room.localParticipant.getTrackPublication(Track.Source.ScreenShare)) {
        const audio = room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
        if (audio) await room.localParticipant.unpublishTrack(audio);
      }
      // A picker may finish after the user has left the call.
      if (room.state !== ConnectionState.Connected) {
        await room.localParticipant.setScreenShareEnabled(false);
      }
    } catch (cause) {
      // Chrome uses NotAllowedError for both picker cancellation and permission denial.
      if (starting && cause instanceof Error && (cause.name === "NotAllowedError" || cause.name === "AbortError")) {
        setScreenMessage("Screen sharing was cancelled or permission was denied. You can try again.");
      } else {
        setScreenMessage(starting ? "Could not share your screen. Please try again." : "Could not stop sharing. Try again or use the browser's Stop sharing control.");
      }
    } finally {
      screenPending.current = false;
      setScreenBusy(false);
    }
  }

  async function setMicrophone(enabled: boolean) {
    setBusy(true);
    setError("");
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      return true;
    } catch {
      setError("Could not change the microphone. Check your browser permissions and audio device.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleMicrophone() {
    // Like Discord: unmuting while deafened also restores incoming audio.
    if (await setMicrophone(!isMicrophoneEnabled) && !isMicrophoneEnabled) setDeafened(false);
  }

  async function toggleDeafen() {
    if (deafened) {
      setDeafened(false);
      if (microphoneBeforeDeafen.current) await setMicrophone(true);
      return;
    }
    // Deafen silences all incoming audio and mutes the microphone; undeafen restores the previous mic state.
    microphoneBeforeDeafen.current = isMicrophoneEnabled;
    setDeafened(true);
    if (isMicrophoneEnabled) await setMicrophone(false);
  }

  return (
    <section className="space-y-5">
      <p role="status"><span className={`badge ${connection === ConnectionState.Connected ? "badge-live" : ""}`}>Connection: {connection}</span></p>
      <h2 className="text-lg font-semibold">Connected participants ({participants.length})</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {participants.map((participant) => (
          <ParticipantRow
            key={participant.identity}
            participant={participant}
            microphoneTracks={microphoneTracks.filter((trackRef) => trackRef.participant.identity === participant.identity)}
            shareTracks={shareTracks.filter((trackRef) => trackRef.participant.identity === participant.identity)}
            deafened={deafened}
          />
        ))}
      </ul>
      <p className="muted text-sm">Volume controls affect only what you hear in this browser.</p>
      <AudioDeviceControls room={room} />
      <div className="card control-bar sticky bottom-3 z-10 shadow-lg" role="toolbar" aria-label="Call controls">
        <button className={`icon-btn ${isMicrophoneEnabled ? "" : "icon-btn-off"}`} aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"} data-tooltip={isMicrophoneEnabled ? "Mute" : "Unmute"} disabled={busy || connection !== ConnectionState.Connected} onClick={() => void toggleMicrophone()}>
          {isMicrophoneEnabled ? <Mic size={22} aria-hidden="true" /> : <MicOff size={22} aria-hidden="true" />}
        </button>
        <button className={`icon-btn ${deafened ? "icon-btn-off" : ""}`} aria-label={deafened ? "Undeafen" : "Deafen"} data-tooltip={deafened ? "Undeafen" : "Deafen"} disabled={busy || connection !== ConnectionState.Connected} onClick={() => void toggleDeafen()}>
          {deafened ? <HeadphoneOff size={22} aria-hidden="true" /> : <Headphones size={22} aria-hidden="true" />}
        </button>
        <button className={`icon-btn ${isScreenShareEnabled ? "icon-btn-on" : ""}`} aria-label={screenBusy ? "Please wait" : isScreenShareEnabled ? "Stop sharing" : "Share screen"} data-tooltip={screenBusy ? "Please wait…" : isScreenShareEnabled ? "Stop sharing" : "Share screen"} disabled={screenBusy || connection !== ConnectionState.Connected} onClick={() => void toggleScreenShare()}>
          {isScreenShareEnabled ? <MonitorOff size={22} aria-hidden="true" /> : <MonitorUp size={22} aria-hidden="true" />}
        </button>
        <button className="icon-btn btn-danger" aria-label="Leave call" data-tooltip="Leave call" onClick={() => void leave()}>
          <LogOut size={22} aria-hidden="true" />
        </button>
      </div>
      <p className="muted text-sm">To share audio, enable the audio checkbox in Chrome&apos;s screen picker when available.</p>
      {screenMessage && <p role="status">{screenMessage}</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <section className="space-y-3" aria-label="Shared screens">
        <h2 className="text-lg font-semibold">Shared screens</h2>
        {screenTracks.length === 0 && <p className="card muted">No one is sharing a screen.</p>}
        {screenTracks.map((trackRef) => (
          trackRef.participant.isLocal ? <figure key={trackRef.publication.trackSid} className="card space-y-3">
            <figcaption>
              <strong>{trackRef.participant.name || trackRef.participant.identity}</strong>
              {trackRef.participant.isLocal ? " (you)" : ""} is sharing
            </figcaption>
            <VideoTrack
              trackRef={trackRef}
              className="screen-video"
              muted
              playsInline
              disablePictureInPicture
            />
          </figure> : <RemoteScreenShare
            key={trackRef.publication.trackSid}
            video={trackRef}
            audio={shareTracks.find((ref) => ref.participant.identity === trackRef.participant.identity && ref.source === Track.Source.ScreenShareAudio)}
            connected={connection === ConnectionState.Connected}
            deafened={deafened}
            room={room}
          />
        ))}
      </section>
      <button onClick={async () => {
        try { await Promise.all([room.startAudio(), room.startVideo()]); setError(""); }
        catch { setError("Playback could not resume. Tap again and check the device audio output."); }
      }}>Enable / resume call playback</button>
    </section>
  );
}

function CallEnvironment({ active }: { active: boolean }) {
  const [status, setStatus] = useState<CallEnvironmentStatus>();
  useEffect(() => observeCallEnvironment(active, setStatus), [active]);
  return (
    <div className="muted space-y-1">
      <p>Page: {status?.visibility ?? "checking"} · Hidden transitions: {status?.hiddenCount ?? 0}</p>
      <p>Wake lock: {status?.wakeLock ?? "checking"}</p>
      {!active && <p>Connection: disconnected</p>}
    </div>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [allowedEmail, setAllowedEmail] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [room, setRoom] = useState<Room>();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const activeRoom = useRef<Room | null>(null);
  const pending = useRef(false);

  useEffect(() => () => {
    const current = activeRoom.current;
    activeRoom.current = null;
    void current?.disconnect();
    if (current) closeAudioDeviceContext(current);
  }, []);

  async function checkAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checkingEmail) return;
    setCheckingEmail(true);
    setError("");
    try {
      const response = await fetch("/api/livekit/access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check access.");
      setAllowedEmail(email.trim().toLowerCase());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check access. Try again.");
    } finally { setCheckingEmail(false); }
  }

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || activeRoom.current || !allowedEmail) return;
    pending.current = true;
    setJoining(true);
    setError("");
    // SDK gain nodes support independent track volume on iOS, where element volume is ignored.
    const nextRoom = createAudioRoom();
    void nextRoom.startAudio().catch(() => {});
    // Install before connecting so future publications and existing microphones are covered.
    const subscribeExistingMicrophones = subscribeMicrophones(nextRoom);
    let microphone: LocalAudioTrack | undefined;
    activeRoom.current = nextRoom;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost and a supported browser.");
      }
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: allowedEmail, avatar }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not get a call token.");
      // Capture only audio and request microphone permission before connecting.
      microphone = await createLocalAudioTrack();
      if (activeRoom.current !== nextRoom) { microphone.stop(); await nextRoom.disconnect(); return; }
      nextRoom.on(RoomEvent.Disconnected, () => {
        if (activeRoom.current === nextRoom) {
          activeRoom.current = null;
          setRoom(undefined);
          setError("The call disconnected. You can join again.");
        }
      });
      await nextRoom.connect(data.serverUrl, data.token, { autoSubscribe: false });
      // Cover publications included in the initial join response as well as event notifications.
      subscribeExistingMicrophones();
      if (activeRoom.current !== nextRoom) { microphone.stop(); await nextRoom.disconnect(); return; }
      await nextRoom.localParticipant.publishTrack(microphone, { source: Track.Source.Microphone });
      if (activeRoom.current !== nextRoom) { microphone.stop(); await nextRoom.disconnect(); return; }
      setRoom(nextRoom);
    } catch (cause) {
      microphone?.stop();
      if (activeRoom.current === nextRoom) {
        activeRoom.current = null;
        setError(cause instanceof Error ? cause.message : "Could not join the call.");
      }
      await nextRoom.disconnect();
      closeAudioDeviceContext(nextRoom);
    } finally {
      pending.current = false;
      setJoining(false);
    }
  }

  async function leave() {
    const current = activeRoom.current;
    activeRoom.current = null;
    setRoom(undefined);
    setError("");
    await current?.disconnect();
    if (current) closeAudioDeviceContext(current);
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <svg width="22" height="28" viewBox="0 0 24 30" fill="var(--accent)">
              <rect x="9" y="0" width="6" height="4" rx="2" />
              <rect x="1" y="6" width="5" height="4" rx="2" />
              <rect x="18" y="6" width="5" height="4" rx="2" />
              <rect x="8" y="5" width="8" height="6" rx="2.5" />
              <rect x="1" y="12" width="5" height="10" rx="2.5" />
              <rect x="18" y="12" width="5" height="10" rx="2.5" />
              <rect x="8" y="12" width="8" height="9" rx="2.5" />
              <rect x="3" y="24" width="4" height="3" rx="1.5" />
              <rect x="17" y="24" width="4" height="3" rx="1.5" />
              <rect x="8" y="22" width="8" height="8" rx="2.5" />
            </svg>
          </span>
          <div>
            <h1 className="brand-word text-3xl">Sabu<span className="brand-dot">.</span>Go</h1>
            <p className="muted text-sm">LiveKit voice call</p>
          </div>
        </div>
        <p className="badge">Room: <strong className="ml-1">games-poc</strong></p>
      </header>
      {room ? (
        <RoomContext.Provider value={room}><Call room={room} leave={leave} /></RoomContext.Provider>
      ) : !allowedEmail ? (
        <form onSubmit={checkAccess} className="card space-y-4">
          <label className="block space-y-2">
            <span>Email address</span>
            <input className="block w-full rounded border px-3 py-2" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} disabled={checkingEmail} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button className="btn-primary" type="submit" disabled={checkingEmail || !email.trim()}>{checkingEmail ? "Checking…" : "Continue"}</button>
        </form>
      ) : (
        <form onSubmit={join} className="card space-y-4">
          <p className="muted text-sm">Email: {allowedEmail}</p>
          <label className="block space-y-2">
            <span>Participant name</span>
            <input className="block w-full rounded border px-3 py-2" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={joining} autoComplete="nickname" />
          </label>
          <fieldset className="space-y-2" disabled={joining}>
            <legend className="mb-2">Avatar</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AVATAR_IDS.map((id) => (
                <label key={id} className="avatar-option" title={avatarPixels(id).label}>
                  <input className="sr-only" type="radio" name="avatar" value={id} checked={avatar === id} onChange={() => setAvatar(id)} aria-label={avatarPixels(id).label} />
                  <PixelAvatar id={id} size={48} />
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary" disabled={joining || !name.trim()} type="submit">{joining ? "Joining…" : "Join call"}</button>
          <button className="ml-3" type="button" disabled={joining} onClick={() => { setAllowedEmail(""); setError(""); }}>Change email</button>
          <p className="muted text-sm" role="status">{joining ? "Requesting microphone access and connecting…" : "Disconnected"}</p>
        </form>
      )}
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-500">{error}</p>}
      <details className="card text-xs">
        <summary className="cursor-pointer text-sm font-semibold">Details</summary>
        <div className="mt-3 space-y-4">
          <CallEnvironment active={Boolean(room)} />
          <CallDiagnostics room={room} />
        </div>
      </details>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AudioTrack, VideoTrack, RoomContext, StartAudio, useConnectionState, useIsSpeaking, useLocalParticipant, useParticipants, useTracks, type TrackReference } from "@livekit/components-react";
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

function RemoteScreenShare({ video, audio, connected }: {
  video: TrackReference;
  audio?: TrackReference;
  connected: boolean;
}) {
  const [watching, setWatching] = useState(false);
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
    <figure className="space-y-2">
      <figcaption><strong>{video.participant.name || video.participant.identity}</strong> is sharing their screen</figcaption>
      <button disabled={!connected} onClick={() => setWatching(!watching)}>
        {watching ? "Stop watching" : "Watch"}
      </button>
      <p className="text-sm" role="status">
        {watching ? "Watching" : "Not watching"} · Video: {videoPublication.isSubscribed ? "subscribed" : "not subscribed"}
        {audioPublication ? ` · Screen audio: ${audioPublication.isSubscribed ? "subscribed" : "not subscribed"}` : " · No screen audio available"}
      </p>
      {watching && (
        <>
          {videoPublication.isSubscribed ? (
            <VideoTrack trackRef={video} manageSubscription={false} className="aspect-video w-full rounded bg-black object-contain" muted playsInline />
          ) : <p>Waiting for screen video subscription…</p>}
          {audio && audioPublication?.isSubscribed && (
            <ScreenAudioControl key={audioPublication.trackSid} trackRef={audio} />
          )}
        </>
      )}
    </figure>
  );
}

function ScreenAudioControl({ trackRef }: { trackRef: TrackReference }) {
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
      <AudioTrack trackRef={trackRef} volume={volume / 100} />
    </>
  );
}

function ParticipantRow({ participant, microphoneTracks, shareTracks }: {
  participant: Participant;
  microphoneTracks: TrackReference[];
  shareTracks: TrackReference[];
}) {
  const isSpeaking = useIsSpeaking(participant);
  const [volume, setVolume] = useState(100);
  const screenVideo = shareTracks.find((ref) => ref.source === Track.Source.ScreenShare);
  const screenAudio = shareTracks.find((ref) => ref.source === Track.Source.ScreenShareAudio);

  return (
    <li className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span>{participant.name || participant.identity}{participant.isLocal ? " (you)" : ""}</span>
        <span className={`rounded px-2 py-1 text-sm ${isSpeaking ? "bg-green-700 text-white" : "opacity-60"}`}>
          {isSpeaking ? "Speaking" : "Not speaking"}
        </span>
      </div>
      <ul className="space-y-1 break-all text-sm">
        <li>Microphone audio: {microphoneTracks.length ? microphoneTracks.map((ref) => `${ref.publication.isMuted ? "Muted" : "Published"} (${ref.publication.trackSid})`).join(", ") : "Not published"}</li>
        <li>Screen-share video: {screenVideo ? `Published (${screenVideo.publication.trackSid})` : "Not published"}</li>
        <li>Screen-share audio: {screenAudio ? `${screenAudio.publication.isMuted ? "Muted" : "Published"} (${screenAudio.publication.trackSid})` : screenVideo ? "No audio track provided by the browser" : "Not published"}</li>
      </ul>
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
            <AudioTrack key={trackRef.publication.trackSid} trackRef={trackRef} volume={volume / 100} />
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

  async function toggleMicrophone() {
    setBusy(true);
    setError("");
    try {
      await room.localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setError("Could not change the microphone. Check your browser permissions and audio device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <p role="status">Connection: {connection}</p>
      <h2 className="text-lg font-semibold">Connected participants ({participants.length})</h2>
      <ul className="space-y-3">
        {participants.map((participant) => (
          <ParticipantRow
            key={participant.identity}
            participant={participant}
            microphoneTracks={microphoneTracks.filter((trackRef) => trackRef.participant.identity === participant.identity)}
            shareTracks={shareTracks.filter((trackRef) => trackRef.participant.identity === participant.identity)}
          />
        ))}
      </ul>
      <p className="text-sm opacity-70">Volume controls affect only what you hear in this browser.</p>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || connection !== ConnectionState.Connected} onClick={toggleMicrophone}>
          {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        </button>
        <button disabled={screenBusy || connection !== ConnectionState.Connected} onClick={() => void toggleScreenShare()}>
          {screenBusy ? "Please wait…" : isScreenShareEnabled ? "Stop sharing" : "Share screen"}
        </button>
        <button onClick={() => void leave()}>Leave call</button>
      </div>
      <p className="text-sm opacity-70">To share audio, enable the audio checkbox in Chrome&apos;s screen picker when available.</p>
      {screenMessage && <p role="status">{screenMessage}</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <section className="space-y-3" aria-label="Shared screens">
        <h2 className="text-lg font-semibold">Shared screens</h2>
        {screenTracks.length === 0 && <p>No one is sharing a screen.</p>}
        {screenTracks.map((trackRef) => (
          trackRef.participant.isLocal ? <figure key={trackRef.publication.trackSid} className="space-y-2">
            <figcaption>
              <strong>{trackRef.participant.name || trackRef.participant.identity}</strong>
              {trackRef.participant.isLocal ? " (you)" : ""} is sharing
            </figcaption>
            <VideoTrack
              trackRef={trackRef}
              className="aspect-video w-full rounded bg-black object-contain"
              muted
              playsInline
            />
          </figure> : <RemoteScreenShare
            key={trackRef.publication.trackSid}
            video={trackRef}
            audio={shareTracks.find((ref) => ref.participant.identity === trackRef.participant.identity && ref.source === Track.Source.ScreenShareAudio)}
            connected={connection === ConnectionState.Connected}
          />
        ))}
      </section>
      <StartAudio label="Enable call audio" />
    </section>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState<Room>();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const activeRoom = useRef<Room | null>(null);
  const pending = useRef(false);

  useEffect(() => () => {
    const current = activeRoom.current;
    activeRoom.current = null;
    void current?.disconnect();
  }, []);

  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || activeRoom.current) return;
    pending.current = true;
    setJoining(true);
    setError("");
    const nextRoom = new Room();
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
        body: JSON.stringify({ name }),
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
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">LiveKit voice call</h1>
      <p>Room: <strong>games-poc</strong></p>
      {room ? (
        <RoomContext.Provider value={room}><Call room={room} leave={leave} /></RoomContext.Provider>
      ) : (
        <form onSubmit={join} className="space-y-4">
          <label className="block space-y-2">
            <span>Participant name</span>
            <input className="block w-full rounded border px-3 py-2" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={joining} autoComplete="nickname" />
          </label>
          <button disabled={joining || !name.trim()} type="submit">{joining ? "Joining…" : "Join call"}</button>
          <p role="status">{joining ? "Requesting microphone access and connecting…" : "Disconnected"}</p>
        </form>
      )}
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </main>
  );
}

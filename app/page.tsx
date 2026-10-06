"use client";

import { useEffect, useRef, useState } from "react";
import { RoomContext, RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant, useParticipants } from "@livekit/components-react";
import { ConnectionState, Room, RoomEvent, Track, createLocalAudioTrack, type LocalAudioTrack } from "livekit-client";

function Call({ room, leave }: { room: Room; leave: () => Promise<void> }) {
  const connection = useConnectionState();
  const participants = useParticipants();
  const { isMicrophoneEnabled } = useLocalParticipant();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      <ul className="list-inside list-disc space-y-2">
        {participants.map((participant) => (
          <li key={participant.identity}>{participant.name || participant.identity}{participant.isLocal ? " (you)" : ""}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy || connection !== ConnectionState.Connected} onClick={toggleMicrophone}>
          {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        </button>
        <button onClick={() => void leave()}>Leave call</button>
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <RoomAudioRenderer />
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
      await nextRoom.connect(data.serverUrl, data.token);
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

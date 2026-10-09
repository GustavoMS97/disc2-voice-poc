"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent, Track, type TrackPublication } from "livekit-client";

type Snapshot = ReturnType<typeof readSnapshot>;
type ReconnectionEvent = { time: string; event: string };

function trackState(publication?: TrackPublication) {
  return publication ? `${publication.isMuted ? "muted" : "published"} · ${publication.trackSid}` : "not published";
}

export function readSnapshot(room?: Room) {
  const participants = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const microphone = room?.localParticipant.getTrackPublication(Track.Source.Microphone);
  return {
    connection: room?.state ?? "disconnected",
    participants: participants.map((participant) => ({
      identity: participant.identity,
      name: participant.name || participant.identity || "Local participant",
      local: participant.isLocal,
      quality: participant.connectionQuality,
      microphone: trackState(participant.getTrackPublication(Track.Source.Microphone)),
    })),
    microphone: !microphone ? "not published" : `${microphone.isMuted ? "muted" : "enabled"} · ${microphone.track ? "track attached" : "no track attached"} · ${microphone.trackSid}`,
    shares: participants.flatMap((participant) => {
      const video = participant.getTrackPublication(Track.Source.ScreenShare);
      const audio = participant.getTrackPublication(Track.Source.ScreenShareAudio);
      if (!video && !audio) return [];
      function state(publication: typeof video) {
        if (!publication) return "not published";
        return `${publication.isMuted ? "muted" : "published"} · ${participant.isLocal ? "local" : publication.isSubscribed ? "subscribed" : "not subscribed"} · ${publication.track ? "track attached" : "no track attached"} · ${publication.trackSid}`;
      }
      return [{ identity: participant.identity, name: participant.name || participant.identity, video: state(video), audio: state(audio) }];
    }),
  };
}

// Read-only, event-driven diagnostics. Does not modify tracks or subscriptions.
export function observeDiagnostics(room: Room, update: (snapshot: Snapshot, event?: string) => void) {
  const refresh = () => update(readSnapshot(room));
  const signalReconnecting = () => update(readSnapshot(room), "signal reconnecting");
  const reconnecting = () => update(readSnapshot(room), "media reconnecting");
  const reconnected = () => update(readSnapshot(room), "reconnected");
  const disconnected = () => update(readSnapshot(room), "disconnected");
  const events = [
    RoomEvent.ConnectionStateChanged, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
    RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackPublished,
    RoomEvent.TrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
    RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackSubscriptionStatusChanged,
    RoomEvent.ConnectionQualityChanged,
  ];
  events.forEach((event) => room.on(event, refresh));
  room.on(RoomEvent.SignalReconnecting, signalReconnecting);
  room.on(RoomEvent.Reconnecting, reconnecting);
  room.on(RoomEvent.Reconnected, reconnected);
  room.on(RoomEvent.Disconnected, disconnected);
  refresh();
  return () => {
    events.forEach((event) => room.off(event, refresh));
    room.off(RoomEvent.SignalReconnecting, signalReconnecting);
    room.off(RoomEvent.Reconnecting, reconnecting);
    room.off(RoomEvent.Reconnected, reconnected);
    room.off(RoomEvent.Disconnected, disconnected);
  };
}

export default function CallDiagnostics({ room }: { room?: Room }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot());
  const [events, setEvents] = useState<ReconnectionEvent[]>([]);
  const [browser, setBrowser] = useState("checking");

  useEffect(() => {
    function update(next: Snapshot, event?: string) {
      setSnapshot(next);
      setBrowser(navigator.userAgent);
      if (event) setEvents((previous) => [...previous, { time: new Date().toLocaleTimeString(), event }].slice(-5));
    }
    if (!room) { update(readSnapshot()); return; }
    return observeDiagnostics(room, update);
  }, [room]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Call diagnostics (local browser)</h3>
      <div className="muted space-y-2">
        <p>Room: games-poc · Connection: {snapshot.connection}</p>
        <p>Participants: {snapshot.participants.length} (includes you)</p>
        <ul>{snapshot.participants.map((participant) => (
          <li key={participant.identity}>{participant.name}{participant.local ? " (you)" : ""} · Quality: {participant.quality} · Microphone: {participant.microphone}</li>
        ))}</ul>
        <p>Local microphone: {snapshot.microphone}</p>
        {snapshot.shares.length === 0 ? <p>Screen publishers: none</p> : snapshot.shares.map((share) => (
          <div key={share.identity}>
            <p>Screen publisher: {share.name}</p>
            <p>ScreenShare video: {share.video}</p>
            <p>ScreenShareAudio: {share.audio}</p>
          </div>
        ))}
        <p>Recent reconnect events (last 5, page lifetime):</p>
        {events.length ? <ul>{events.map((event, index) => <li key={index}>{event.time} · {event.event}</li>)}</ul> : <p>None observed.</p>}
        <p className="break-all">Browser-reported user agent: {browser}</p>
        <p className="opacity-70">Quality is the SDK estimate, not a latency measurement. Published/attached tracks do not prove audible audio or moving video.</p>
      </div>
    </div>
  );
}

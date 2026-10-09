import { Room, RoomEvent } from "livekit-client";

export type AudioDeviceKind = "audioinput" | "audiooutput";
type OutputContext = AudioContext & { setSinkId?: (id: string) => Promise<void> };
const contexts = new WeakMap<Room, OutputContext>();
const key = (kind: AudioDeviceKind) => `games-poc.${kind}`;

export function savedAudioDevice(kind: AudioDeviceKind) {
  try { return localStorage.getItem(key(kind)) || "default"; } catch { return "default"; }
}

export function closeAudioDeviceContext(room: Room) {
  const context = contexts.get(room);
  contexts.delete(room);
  if (context && context.state !== "closed") void context.close().catch(() => {});
}

export function createAudioRoom() {
  let context: AudioContext | undefined;
  try { if (typeof AudioContext !== "undefined") context = new AudioContext(); }
  catch { /* Let LiveKit use its normal AudioContext fallback. */ }
  const room = new Room({ webAudioMix: context ? { audioContext: context } : true });
  if (context) contexts.set(room, context);
  room.once(RoomEvent.Disconnected, () => closeAudioDeviceContext(room));
  return room;
}

export function supportsAudioOutput(room: Room) {
  return typeof contexts.get(room)?.setSinkId === "function";
}

export async function switchAudioDevice(room: Room, kind: AudioDeviceKind, id: string) {
  if (kind === "audiooutput") {
    const context = contexts.get(room);
    if (!context?.setSinkId) throw new Error("Output selection is not supported by this browser.");
    const sink = id === "default" ? "" : id;
    const previous = room.getActiveDevice(kind) || "";
    // Await the actual playback sink before the SDK updates all current/future tracks.
    await context.setSinkId(sink);
    try {
      if (!await room.switchActiveDevice(kind, sink)) throw new Error("Could not switch output.");
    } catch (cause) {
      try {
        await context.setSinkId(previous);
        await room.switchActiveDevice(kind, previous);
      } catch { /* Report the failure; browser default/another device remains selectable. */ }
      throw cause;
    }
  } else if (!await room.switchActiveDevice(kind, id)) {
    throw new Error("Could not switch microphone.");
  }
  try { localStorage.setItem(key(kind), id); } catch { /* Storage is optional. */ }
}

export async function restoreAudioDevice(room: Room, kind: AudioDeviceKind) {
  if (kind === "audiooutput" && !supportsAudioOutput(room)) return;
  const saved = savedAudioDevice(kind);
  if (saved === "default") return;
  const devices = await Room.getLocalDevices(kind, false);
  if (!devices.some((device) => device.deviceId === saved)) {
    await switchAudioDevice(room, kind, "default");
    return;
  }
  try { await switchAudioDevice(room, kind, saved); }
  catch { await switchAudioDevice(room, kind, "default"); }
}

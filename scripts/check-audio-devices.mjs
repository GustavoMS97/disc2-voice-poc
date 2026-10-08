import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const { RemoteAudioTrack, RemoteParticipant, Room, RoomEvent, Track } = createRequire(import.meta.url)("livekit-client");

const filename = fileURLToPath(new URL("../app/lib/audio-devices.ts", import.meta.url));
const instance = new Module(filename);
instance.filename = filename;
instance.require = createRequire(filename);
instance._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { createAudioRoom, supportsAudioOutput, switchAudioDevice, restoreAudioDevice, closeAudioDeviceContext, savedAudioDevice } = instance.exports;
const globals = ["AudioContext", "localStorage", "document"];
const originals = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
const originalDevices = Room.getLocalDevices;
const storage = new Map();
class Context {
  state = "running";
  sinkId = "";
  async setSinkId(id) {
    if (id === "denied") throw new DOMException("Denied", "NotAllowedError");
    this.sinkId = id;
  }
  async close() { this.state = "closed"; }
}
try {
  Object.defineProperty(globalThis, "AudioContext", { value: Context, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: {
    getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value),
  }, configurable: true });
  const room = createAudioRoom();
  Object.defineProperty(globalThis, "document", { value: {
    createElement: () => ({ setSinkId: async () => {} }),
  }, configurable: true });
  const context = room.options.webAudioMix.audioContext;
  // Model the SDK's acquisition of the provided context without browser playback.
  room.audioContext = context;
  assert.equal(supportsAudioOutput(room), true);
  const remote = new RemoteParticipant("remote-sid", "remote");
  const voice = new RemoteAudioTrack({ id: "voice" }, "voice", {});
  const screen = new RemoteAudioTrack({ id: "screen" }, "screen", {});
  let voiceSink, screenSink;
  voice.setSinkId = async (id) => {
    if (id === "track-denied") throw new Error("Track output denied");
    voiceSink = id;
  };
  screen.setSinkId = async (id) => { screenSink = id; };
  remote.audioTrackPublications.set("voice", { track: voice });
  remote.audioTrackPublications.set("screen", { track: screen });
  room.remoteParticipants.set("remote", remote);
  await switchAudioDevice(room, "audiooutput", "sonar-gaming");
  assert.equal(context.sinkId, "sonar-gaming");
  await assert.rejects(switchAudioDevice(room, "audiooutput", "track-denied"), /Track output denied/);
  assert.equal(context.sinkId, "sonar-gaming", "SDK track failure restores the context output");
  assert.equal(voiceSink, "sonar-gaming");
  assert.equal(screenSink, "sonar-gaming");
  assert.equal(voiceSink, "sonar-gaming");
  assert.equal(screenSink, "sonar-gaming");
  assert.equal(room.options.audioOutput.deviceId, "sonar-gaming", "SDK retains sink for future participants/tracks");
  await assert.rejects(switchAudioDevice(room, "audiooutput", "denied"), /Denied/);
  assert.equal(savedAudioDevice("audiooutput"), "sonar-gaming", "Failed choices are not persisted");
  assert.equal(context.sinkId, "sonar-gaming");
  await switchAudioDevice(room, "audiooutput", "default");
  assert.equal(context.sinkId, "");
  assert.equal(voiceSink, "");
  assert.equal(screenSink, "");

  let microphoneDevice;
  const microphone = { isMuted: true, setDeviceId: async (constraint) => { microphoneDevice = constraint.exact; return true; } };
  room.localParticipant.audioTrackPublications.set("local-mic", { source: Track.Source.Microphone, track: microphone, audioTrack: microphone });
  await switchAudioDevice(room, "audioinput", "mic-2");
  assert.equal(microphoneDevice, "mic-2");
  assert.equal(microphone.isMuted, true, "Device switch preserves mute state");
  assert.equal(savedAudioDevice("audioinput"), "mic-2");
  Room.getLocalDevices = async () => [{ deviceId: "mic-2" }];
  microphoneDevice = undefined;
  await restoreAudioDevice(room, "audioinput");
  assert.equal(microphoneDevice, "mic-2");
  Room.getLocalDevices = async () => [];
  await restoreAudioDevice(room, "audioinput");
  assert.equal(microphoneDevice, "default");
  assert.equal(savedAudioDevice("audioinput"), "default");
  room.emit(RoomEvent.Disconnected);
  assert.equal(context.state, "closed");
  closeAudioDeviceContext(room);
  delete Context.prototype.setSinkId;
  delete globalThis.document;
  const unsupportedRoom = createAudioRoom();
  assert.equal(supportsAudioOutput(unsupportedRoom), false);
  await assert.rejects(switchAudioDevice(unsupportedRoom, "audiooutput", "speaker"), /not supported/);
  closeAudioDeviceContext(unsupportedRoom);
  console.log("PASS: SDK microphone switching/mute preservation, all-source output routing, denied output, restoration/default fallback, unsupported API and context cleanup.");
} finally {
  Room.getLocalDevices = originalDevices;
  globals.forEach((key, index) => {
    if (originals[index]) Object.defineProperty(globalThis, key, originals[index]);
    else delete globalThis[key];
  });
}

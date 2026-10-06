import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { RoomEvent, Track } from "livekit-client";

const filename = fileURLToPath(new URL("../app/call-diagnostics.tsx", import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const diagnosticsModule = new Module(filename);
diagnosticsModule.filename = filename;
diagnosticsModule.require = createRequire(filename);
diagnosticsModule._compile(compiled, filename);
const { readSnapshot, observeDiagnostics } = diagnosticsModule.exports;

function participant(identity, local, publications) {
  return {
    identity, name: identity, isLocal: local, connectionQuality: "excellent",
    getTrackPublication: (source) => publications.get(source),
  };
}
const microphone = { trackSid: "mic", isMuted: true, track: {} };
const video = { isMuted: false, isSubscribed: false, track: undefined };
const audio = { isMuted: false, isSubscribed: false, track: undefined };
const localPublications = new Map([[Track.Source.Microphone, microphone]]);
const remotePublications = new Map([[Track.Source.ScreenShare, video], [Track.Source.ScreenShareAudio, audio]]);
const local = participant("bob", true, localPublications);
const remote = participant("alice", false, remotePublications);
const room = new EventEmitter();
room.state = "connected";
room.localParticipant = local;
room.remoteParticipants = new Map([[remote.identity, remote]]);
let snapshot;
const events = [];
const cleanup = observeDiagnostics(room, (value, event) => {
  snapshot = value;
  if (event) events.push(event);
});
assert.equal(snapshot.participants.length, 2);
assert.deepEqual(snapshot.participants.map((entry) => entry.name), ["bob", "alice"]);
assert.match(snapshot.microphone, /muted/);
assert.match(snapshot.shares[0].video, /not subscribed/);
assert.match(snapshot.shares[0].audio, /not subscribed/);

video.isSubscribed = true;
video.track = {};
room.emit(RoomEvent.TrackSubscribed);
assert.match(snapshot.shares[0].video, /published · subscribed · track attached/);
assert.match(snapshot.shares[0].audio, /not subscribed/);
remote.connectionQuality = "poor";
room.emit(RoomEvent.ConnectionQualityChanged);
assert.equal(snapshot.participants[1].quality, "poor");
microphone.isMuted = false;
room.emit(RoomEvent.TrackUnmuted);
assert.match(snapshot.microphone, /enabled/);
room.state = "reconnecting";
room.emit(RoomEvent.SignalReconnecting);
room.emit(RoomEvent.Reconnecting);
assert.equal(snapshot.connection, "reconnecting");
room.state = "connected";
room.emit(RoomEvent.Reconnected);
assert.deepEqual(events, ["signal reconnecting", "media reconnecting", "reconnected"]);
remotePublications.clear();
room.emit(RoomEvent.TrackUnpublished);
assert.equal(snapshot.shares.length, 0);
room.remoteParticipants.clear();
room.emit(RoomEvent.ParticipantDisconnected);
assert.equal(snapshot.participants.length, 1);
cleanup();
assert.equal(room.eventNames().length, 0, "Diagnostics remove all listeners");
assert.equal(readSnapshot().connection, "disconnected");
assert.equal(readSnapshot().participants.length, 0);
console.log("PASS: diagnostics snapshots, publication/subscription distinction, quality, reconnect events, removal and listener cleanup.");

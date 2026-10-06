import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { trackReferencesObservable } from "@livekit/components-core";
import { RoomEvent, Track } from "livekit-client";

// Read the actual Call hook configuration, then exercise the installed SDK's
// publication discovery. This catches its subscribed-only default without a mock.
const source = ts.createSourceFile("page.tsx", readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const call = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "Call");
let onlySubscribed;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "shareTracks") {
    const options = node.initializer.arguments[1];
    const property = options?.properties.find((item) => item.name?.getText(source) === "onlySubscribed");
    onlySubscribed = property?.initializer.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
  }
  ts.forEachChild(node, visit);
}
assert.ok(call, "Call component exists");
visit(call);

const video = { source: Track.Source.ScreenShare, trackSid: "screen-video", track: undefined };
const audio = { source: Track.Source.ScreenShareAudio, trackSid: "screen-audio", track: undefined };
const remote = { identity: "alice", trackPublications: new Map([[video.trackSid, video]]) };
const room = new EventEmitter();
room.localParticipant = { identity: "bob", trackPublications: new Map() };
room.remoteParticipants = new Map([[remote.identity, remote]]);
const sources = [Track.Source.ScreenShare, Track.Source.ScreenShareAudio];
let references;
const subscription = trackReferencesObservable(room, sources, { onlySubscribed }).subscribe((value) => {
  references = value.trackReferences;
});
assert.equal(references.length, 1, "Existing unsubscribed share is discoverable before Watch");
assert.equal(references[0].publication, video);
assert.equal(video.track, undefined, "Discovery does not attach screen media");

remote.trackPublications.set(audio.trackSid, audio);
room.emit(RoomEvent.TrackPublished, audio, remote);
assert.equal(references.length, 2, "Late unpublished-media audio is also discoverable");

video.track = {};
audio.track = {};
room.emit(RoomEvent.TrackSubscriptionStatusChanged, video, remote);
video.track = undefined;
audio.track = undefined;
room.emit(RoomEvent.TrackUnsubscribed, undefined, video, remote);
assert.equal(references.length, 2, "Stop watching retains available publications");

remote.trackPublications.clear();
room.emit(RoomEvent.TrackUnpublished, video, remote);
assert.equal(references.length, 0, "Stopping sharing removes availability");
subscription.unsubscribe();
console.log("PASS: discover unsubscribed shares, late audio, stop-watching availability, and stopped-share cleanup using the installed LiveKit observable.");

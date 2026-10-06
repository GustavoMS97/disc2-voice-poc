import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { RemoteAudioTrack } from "livekit-client";

const code = ts.transpileModule(readFileSync(new URL("../app/lib/call-environment.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { observeCallEnvironment, enterVideoFullscreen } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const settle = () => new Promise((resolve) => setImmediate(resolve));

class Sentinel extends EventTarget {
  released = false;
  async release() {
    this.released = true;
    this.dispatchEvent(new Event("release"));
  }
}

try {
  const document = new EventTarget();
  document.visibilityState = "visible";
  document.fullscreenEnabled = true;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  let locks = [];
  const navigator = { wakeLock: { request: async () => {
    const sentinel = new Sentinel();
    locks.push(sentinel);
    return sentinel;
  } } };
  Object.defineProperty(globalThis, "navigator", { value: navigator, configurable: true });
  let status;
  const update = (value) => { status = value; };
  const visibility = (state) => {
    document.visibilityState = state;
    document.dispatchEvent(new Event("visibilitychange"));
  };

  let cleanup = observeCallEnvironment(true, update);
  await settle();
  assert.equal(status.wakeLock, "active");
  visibility("hidden");
  await settle();
  assert.equal(locks[0].released, true);
  assert.equal(status.visibility, "hidden");
  assert.equal(status.hiddenCount, 1);
  visibility("visible");
  await settle();
  assert.equal(locks.length, 2);
  assert.equal(status.wakeLock, "active");
  await locks[1].release();
  assert.equal(status.wakeLock, "released by browser");
  visibility("hidden");
  visibility("visible");
  await settle();
  assert.equal(status.wakeLock, "active");
  cleanup();
  assert.equal(locks[2].released, true, "Leaving releases the held lock");
  const count = locks.length;
  visibility("hidden");
  visibility("visible");
  await settle();
  assert.equal(locks.length, count, "Leaving removes visibility listeners");
  cleanup = observeCallEnvironment(false, update);
  await settle();
  assert.equal(status.wakeLock, "inactive");
  assert.equal(locks.length, count);
  cleanup();

  delete navigator.wakeLock;
  cleanup = observeCallEnvironment(true, update);
  assert.equal(status.wakeLock, "unsupported");
  cleanup();
  let deniedRequests = 0;
  navigator.wakeLock = { request: async () => {
    deniedRequests++;
    throw new DOMException("Denied", "NotAllowedError");
  } };
  cleanup = observeCallEnvironment(true, update);
  await settle();
  assert.match(status.wakeLock, /unavailable.*NotAllowedError/);
  assert.equal(deniedRequests, 1, "Denied lock does not cause a retry loop");
  cleanup();

  let resolvePending;
  navigator.wakeLock.request = () => new Promise((resolve) => { resolvePending = resolve; });
  cleanup = observeCallEnvironment(true, update);
  cleanup();
  const lateLock = new Sentinel();
  resolvePending(lateLock);
  await settle();
  assert.equal(lateLock.released, true, "A lock acquired after leaving is released");

  locks = [];
  let requestCount = 0;
  navigator.wakeLock.request = () => {
    requestCount++;
    if (requestCount === 1) return new Promise((resolve) => { resolvePending = resolve; });
    const sentinel = new Sentinel();
    locks.push(sentinel);
    return Promise.resolve(sentinel);
  };
  cleanup = observeCallEnvironment(true, update);
  visibility("hidden");
  visibility("visible");
  const staleLock = new Sentinel();
  resolvePending(staleLock);
  await settle();
  assert.equal(staleLock.released, true);
  assert.equal(requestCount, 2, "Hide/return during request makes a fresh attempt");
  assert.equal(status.wakeLock, "active");
  cleanup();

  let standardCalls = 0;
  await enterVideoFullscreen({ requestFullscreen: async () => { standardCalls++; } });
  assert.equal(standardCalls, 1);
  let nativeCalls = 0;
  await enterVideoFullscreen({
    requestFullscreen: async () => { throw new Error("Unsupported standard fullscreen"); },
    webkitSupportsFullscreen: true,
    webkitEnterFullscreen: () => { nativeCalls++; },
  });
  assert.equal(nativeCalls, 1, "Native Safari video fullscreen fallback");
  await assert.rejects(enterVideoFullscreen({}), /Continue watching inline/);
  await assert.rejects(enterVideoFullscreen({ webkitSupportsFullscreen: false, webkitEnterFullscreen: () => { throw new Error("Must not call"); } }), /Continue watching inline/);

  // Exercise the installed SDK's gain path without relying on iOS element.volume.
  const microphone = new RemoteAudioTrack({ id: "mic" }, "mic-sid", {}, {});
  const screenAudio = new RemoteAudioTrack({ id: "screen" }, "screen-sid", {}, {});
  let microphoneGain = 1;
  let screenGain = 1;
  const element = { set volume(_value) { throw new Error("Must use Web Audio gain"); } };
  microphone.attachedElements.push(element);
  screenAudio.attachedElements.push(element);
  microphone.gainNode = { gain: { setTargetAtTime: (value) => { microphoneGain = value; } } };
  screenAudio.gainNode = { gain: { setTargetAtTime: (value) => { screenGain = value; } } };
  microphone.setVolume(0.4);
  assert.equal(microphoneGain, 0.4);
  assert.equal(screenGain, 1);
  screenAudio.setVolume(0);
  assert.equal(screenGain, 0);
  assert.equal(microphoneGain, 0.4);
  console.log("PASS: wake-lock lifecycle/races, fullscreen fallback, and independent SDK Web Audio gains.");
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else delete globalThis.document;
}

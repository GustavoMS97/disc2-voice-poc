export type CallEnvironmentStatus = {
  visibility: DocumentVisibilityState;
  hiddenCount: number;
  wakeLock: string;
};

// Observe normal browser lifecycle only; do not keep a hidden page alive.
export function observeCallEnvironment(active: boolean, update: (status: CallEnvironmentStatus) => void) {
  let disposed = false;
  let pending = false;
  let sentinel: WakeLockSentinel | undefined;
  let hiddenCount = 0;
  let visibilityVersion = 0;
  let wakeLock = active ? "requesting" : "inactive";
  const supported = "wakeLock" in navigator;

  function report() {
    if (!disposed) update({ visibility: document.visibilityState, hiddenCount, wakeLock });
  }

  async function release() {
    const current = sentinel;
    sentinel = undefined;
    try { await current?.release(); } catch { /* Release failure must not affect the call. */ }
  }

  async function acquire() {
    if (!active || disposed || pending || sentinel || document.visibilityState !== "visible") return;
    if (!supported) { wakeLock = "unsupported"; report(); return; }
    pending = true;
    const requestVisibilityVersion = visibilityVersion;
    wakeLock = "requesting";
    report();
    try {
      const acquired = await navigator.wakeLock.request("screen");
      if (disposed || document.visibilityState !== "visible" || requestVisibilityVersion !== visibilityVersion) {
        await acquired.release();
        return;
      }
      sentinel = acquired;
      acquired.addEventListener("release", () => {
        if (sentinel !== acquired) return;
        sentinel = undefined;
        wakeLock = "released by browser";
        report();
      }, { once: true });
      wakeLock = acquired.released ? "released by browser" : "active";
      if (acquired.released) sentinel = undefined;
      report();
    } catch (cause) {
      wakeLock = `unavailable${cause instanceof Error ? ` (${cause.name})` : ""}`;
      report();
    } finally {
      pending = false;
      // If hide/return raced a pending request, make one fresh visible-page attempt.
      if (!disposed && requestVisibilityVersion !== visibilityVersion && document.visibilityState === "visible") void acquire();
    }
  }

  function visibilityChanged() {
    visibilityVersion += 1;
    if (document.visibilityState === "hidden") {
      hiddenCount += 1;
      wakeLock = active && supported ? "released (page hidden)" : active ? "unsupported" : "inactive";
      void release();
    }
    report();
    if (document.visibilityState === "visible") void acquire();
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  if (active && document.visibilityState === "hidden") wakeLock = supported ? "waiting for visible page" : "unsupported";
  report();
  void acquire();
  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", visibilityChanged);
    void release();
  };
}

type SafariVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

export async function enterVideoFullscreen(video: SafariVideo) {
  if (video.requestFullscreen && document.fullscreenEnabled) {
    try { await video.requestFullscreen(); return; } catch {
      // Safari may expose the standard method but only allow native video fullscreen.
    }
  }
  if (video.webkitEnterFullscreen && video.webkitSupportsFullscreen !== false) {
    video.webkitEnterFullscreen();
    return;
  }
  throw new Error("Fullscreen is unavailable for this video/browser. Continue watching inline.");
}

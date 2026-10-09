"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { ConnectionState, Room } from "livekit-client";
import { restoreAudioDevice, supportsAudioOutput, switchAudioDevice, type AudioDeviceKind } from "./lib/audio-devices";

function DeviceSelect({ room, kind }: { room: Room; kind: AudioDeviceKind }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  const restored = useRef(false);
  const restoration = useRef<Promise<void> | null>(null);
  const onError = useCallback(() => setMessage("Could not list devices. Check browser permissions."), []);
  const { devices, activeDeviceId } = useMediaDeviceSelect({ room, kind, requestPermissions: false, onError });
  const supported = kind === "audioinput" || supportsAudioOutput(room);

  useEffect(() => {
    let disposed = false;
    pending.current = true;
    restoration.current ??= restoreAudioDevice(room, kind);
    void restoration.current.catch(() => {
      if (!disposed) setMessage("Could not restore this device. Choose another device or system default.");
    }).finally(() => {
      restored.current = true;
      pending.current = false;
      if (!disposed) setBusy(false);
    });
    return () => { disposed = true; };
  }, [room, kind]);

  useEffect(() => {
    if (!supported) return;
    async function changed() {
      if (pending.current || !restored.current || room.state !== ConnectionState.Connected) return;
      pending.current = true;
      try {
        const available = await Room.getLocalDevices(kind, false);
        const current = room.getActiveDevice(kind);
        if (current && current !== "default" && !available.some((device) => device.deviceId === current)) {
          await switchAudioDevice(room, kind, "default");
          setMessage("Selected device disconnected. Using system default.");
        }
      } catch { setMessage("Device changed, but switching failed. Choose an available device."); }
      finally { pending.current = false; }
    }
    navigator.mediaDevices?.addEventListener("devicechange", changed);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", changed);
  }, [room, kind, supported]);

  async function select(id: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try { await switchAudioDevice(room, kind, id); }
    catch { setMessage("Could not select this device. Check permissions or choose another device."); }
    finally { pending.current = false; setBusy(false); }
  }

  const active = (kind === "audiooutput" ? room.getActiveDevice(kind) : activeDeviceId) || "default";
  return (
    <div className="min-w-0 space-y-1">
      <label className="block space-y-1 text-sm">
        <span>{kind === "audioinput" ? "Microphone" : "Output"}</span>
        <select value={active} disabled={!supported || busy || room.state !== ConnectionState.Connected} onChange={(event) => void select(event.target.value)}>
          <option value="default">System default</option>
          {active !== "default" && !devices.some((device) => device.deviceId === active) && <option value={active}>Current device</option>}
          {devices.filter((device) => device.deviceId && device.deviceId !== "default").map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>{device.label || `${kind === "audioinput" ? "Microphone" : "Output"} ${index + 1}`}</option>
          ))}
        </select>
      </label>
      {!supported && <p className="muted text-sm">Output selection is unavailable here. Using system output.</p>}
      {message && <p role="status" className="muted text-sm">{message}</p>}
    </div>
  );
}

export default function AudioDeviceControls({ room }: { room: Room }) {
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-semibold">Audio devices</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DeviceSelect room={room} kind="audioinput" />
        <DeviceSelect room={room} kind="audiooutput" />
      </div>
    </details>
  );
}

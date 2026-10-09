import { avatarPixels } from "./lib/avatars";

export default function PixelAvatar({ id, size = 40 }: { id: string; size?: number }) {
  const { pixels } = avatarPixels(id);
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {pixels.map(({ x, y, color }) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />)}
    </svg>
  );
}

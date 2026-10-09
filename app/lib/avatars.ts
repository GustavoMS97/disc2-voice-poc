// Eight 12×12 pixel-art avatars. Shared by the token route (validation) and the UI (drawing).
type Look = {
  label: string;
  hair: "short" | "spiky" | "long" | "bun" | "mohawk" | "cap" | "headphones" | "bald";
  glasses?: boolean;
  skin: string;
  hairColor: string;
  shirt: string;
};

const LOOKS: Look[] = [
  { label: "Cap", hair: "cap", skin: "#f1c27d", hairColor: "#3b2a1a", shirt: "#fbb423" },
  { label: "Headphones", hair: "headphones", skin: "#c68642", hairColor: "#5a3a22", shirt: "#4f7cff" },
  { label: "Spiky", hair: "spiky", skin: "#ffdbac", hairColor: "#e8552d", shirt: "#2bb673" },
  { label: "Long hair", hair: "long", skin: "#8d5524", hairColor: "#4a3566", shirt: "#c04cf0" },
  { label: "Glasses", hair: "short", glasses: true, skin: "#e0ac69", hairColor: "#6b4226", shirt: "#f3efe4" },
  { label: "Bun", hair: "bun", skin: "#ffdbac", hairColor: "#f2c94c", shirt: "#e5484d" },
  { label: "Mohawk", hair: "mohawk", skin: "#c68642", hairColor: "#ff4fa3", shirt: "#7c5cff" },
  { label: "Bald", hair: "bald", glasses: true, skin: "#8d5524", hairColor: "#8d5524", shirt: "#3ccf6e" },
];

export const AVATAR_IDS = LOOKS.map((_, index) => String(index + 1));
export const DEFAULT_AVATAR = AVATAR_IDS[0];

export function isAvatarId(value: unknown): value is string {
  return typeof value === "string" && AVATAR_IDS.includes(value);
}

const HAIR: Record<Look["hair"], string[]> = {
  short: ["............", "....HHHH....", "...HHHHHH...", "...HHHHHH..."],
  spiky: ["...H.H.H.H..", "...HHHHHHH..", "...HHHHHH...", "...HSSSSH..."],
  long: ["............", "....HHHH....", "...HHHHHH...", "..HHHHHHHH.."],
  bun: [".....HH.....", "....HHHH....", "...HHHHHH...", "...HHHHHH..."],
  mohawk: [".....HH.....", ".....HH.....", "....HHHH....", "...SSHHSS..."],
  cap: ["............", "....CCCC....", "...CCCCCC...", "...CCCCCCCC."],
  headphones: ["....PPPP....", "...PHHHHP...", "..PHHHHHHP..", "..PHHHHHHP.."],
  bald: ["............", "............", "....SSSS....", "...SSSSSS..."],
};

const FACE = ["...SSSSSS...", "...SESSES...", "...SSSSSS...", "...SSMMSS...", ".....SS....."];
const BODY = ["...TTTTTT...", "..TTTTTTTT..", "..TTTTTTTT.."];

export function avatarPixels(id: string) {
  const look = LOOKS[Math.max(0, AVATAR_IDS.indexOf(id))];
  const face = FACE.map((row, index) => {
    let next = row;
    if (look.glasses && index === 1) next = "..GGEGGEGG..";
    if (look.hair === "long" && index < 4) next = `..H${next.slice(3, 9)}H..`;
    if (look.hair === "headphones" && index < 2) next = `..P${next.slice(3, 9)}P..`;
    return next;
  });
  const colors: Record<string, string> = {
    H: look.hairColor, S: look.skin, E: "#0c0c0f", M: "#7a2e2e", T: look.shirt,
    C: "#fbb423", P: "#2c2c33", G: "#0c0c0f",
  };
  const pixels: { x: number; y: number; color: string }[] = [];
  [...HAIR[look.hair], ...face, ...BODY].forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (colors[cell]) pixels.push({ x, y, color: colors[cell] });
    });
  });
  return { label: look.label, pixels };
}

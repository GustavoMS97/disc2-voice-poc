// Eight 16×16 pixel-art avatars. Shared by the token route (validation) and the UI (drawing).
// Each row is one line of pixels; "." is transparent and every other letter maps to a color in `colors`.
type Look = { label: string; rows: string[]; colors: Record<string, string> };

const LOOKS: Look[] = [
  {
    label: "Killjoy",
    rows: [
      "....gGGGGGGg....",
      "...GGGGPPGGGG...",
      "..GGGGGPPGGGGG..",
      "..gggggggggggg..",
      "..KKKKKSSSSSKK..",
      "..KSOOSSSSOOSK..",
      "..KOWEOOOOEWOK..",
      "..KSOOSSSSOOSK..",
      "..KKSSSsSSSSKK..",
      "..KKSSSLLSSSKK..",
      "..KKKSSSSSSKKK..",
      ".YYKKKsTTsKKKYY.",
      "YVYYYYTTTTYYYYVY",
      "VVVYYYTTTTYYYVVV",
      "YVYYYyTTTTyYYYVY",
      "YYYYYyTTTTyYYYYY",
    ],
    colors: { E: "#3a2626", G: "#3e8e5a", K: "#15151b", L: "#a0524f", O: "#0b0b0f", P: "#c9b9a6", S: "#e8b796", T: "#4a4a55", V: "#b06be0", W: "#b8c8f0", Y: "#fbb423", g: "#2b6a42", s: "#c98e72", y: "#d9901a" },
  },
  {
    label: "Omen",
    rows: [
      "......QQPP......",
      ".....QQPPPP.....",
      "....QQPPPPPP....",
      "...QQPPPPPPPp...",
      "...QPPPPPPPPp...",
      "..QPPpNNNNpPPp..",
      "..QPpNNNNNNpPp..",
      "..QPpNBNBNBpPp..",
      "..QPpNBNBNBNpp..",
      "..QPpNNBNBNNpp..",
      "..QPPpNNNNNpPp..",
      ".QQPPPpNNNpPPPp.",
      "QQPPPPPpNpPPPPPp",
      "QPPPPPPPpPPPPPPp",
      "QPPPPPPPPPPPPPPp",
      "QPPPPPPPPPPPPPPp",
    ],
    colors: { B: "#3fd8ff", N: "#0a0a12", P: "#5b4fc4", Q: "#8a7fe6", p: "#3f348f" },
  },
  {
    label: "Sage",
    rows: [
      ".......KK.......",
      "......KKKK......",
      "....KKKkkKKK....",
      "...KKkkKKkkKK...",
      "...KKSSSSSSKK...",
      "..KKSSSSSSSSKK..",
      "..KKSEESSEESKK..",
      "..KSSSSSSSSGKK..",
      "..KGSSSssSSGKK..",
      "..KKSSSLLSGGKK..",
      "..KKKSSSSSGKKK..",
      "..KKKKsTTsKKKK..",
      ".CCKKTTTTTTKKCC.",
      "CCCCCTTTTTTCCCCC",
      "CCCCCTTTTTTCCCCC",
      "CCCCCTTTTTTCCCCC",
    ],
    colors: { C: "#6fb5b0", E: "#2a2a30", G: "#2fe0a0", K: "#33364a", L: "#c0453c", S: "#ebc3a8", T: "#3c3c48", k: "#565c80", s: "#cf9c80" },
  },
  {
    label: "Sova",
    rows: [
      "....HHHHHHH.....",
      "...HHHHHHHHHH...",
      "..HHHHhHHHHHHH..",
      "..UHHSSSSSHHHH..",
      "..USSSSSSSSSHh..",
      "..USKKSSSKKSSh..",
      "..USSESSSSESSh..",
      "..SSSSSSsSSSSh..",
      ".gSSSSSsSSSSSh..",
      "..SSSSSmmSSSSh..",
      "...sSSSSSSSs....",
      "..FFFsSSSsFFF...",
      ".FFFFFsssFFFFFF.",
      "FFFfFFFFFFFFfFFF",
      "JJFFfFFFFFFfFFJJ",
      "JJJFFFFFFFFFFJJJ",
    ],
    colors: { E: "#4fb8ff", F: "#edeae0", H: "#e2d3a0", J: "#3a6fd8", K: "#5a4a3a", S: "#ebc3a8", U: "#6b6258", f: "#c8c4b8", g: "#9aa0b0", h: "#b8a774", m: "#b07060", s: "#cf9c80" },
  },
  {
    label: "Reyna",
    rows: [
      ".....KKKKKK.....",
      "....KKKKKKKK....",
      "...VKKKKKKKKV...",
      "..VVKDDDDDDKVV..",
      "..VKDDDDDDDDKV..",
      "..VKDKKDDKKDKV..",
      "..VKDEEDDEEDKV..",
      "..VODDDDdDDDOV..",
      "..VODDDddDDDOV..",
      "..VODDDLLDDDOV..",
      "..VVODDDDDDOVV..",
      ".VVVKdDDDDdKVVV.",
      "VVVVKTTOOTTKVVVV",
      "VVVvKTOTTOTKvVVV",
      "VVvvKTTOOTTKvvVV",
      "VvvvKTTTTTTKvvvV",
    ],
    colors: { D: "#7a4e38", E: "#ff5ae6", K: "#3a3448", L: "#5a2a3a", O: "#e0b040", T: "#1a1a20", V: "#a33fd6", d: "#5e3a29", v: "#6d2694" },
  },
  {
    label: "Cypher",
    rows: [
      "......WWWW......",
      ".....WWWWWW.....",
      "....WWWWWWWW....",
      "....BBBAcABB....",
      ".WWWWWWWWWWWWWW.",
      "WWwwwwwwwwwwwwWW",
      "....NNNNNNNN....",
      "....NcNNnNNN....",
      "....NNNNnNNN....",
      "...FFFFNNFFFF...",
      "..FFFFFFFFFFFF..",
      "..fFFFFfFFFFFf..",
      ".RRfFFFFFFFFfRR.",
      "RRRRfFFFFFFfRRRR",
      "RRRRRffFFffRRRRR",
      "RRRRRRRAARRRRRRR",
    ],
    colors: { A: "#b07a3a", B: "#2e5a9a", F: "#d8d4c8", N: "#1e2238", R: "#6b4a33", W: "#e8e6de", c: "#3fe0e0", f: "#a8a498", n: "#33395a", w: "#b8b5aa" },
  },
  {
    label: "Harbor",
    rows: [
      "......KKK.......",
      ".....KKkKK......",
      "....KKKKKKKK....",
      "...KKkKKKKkKK...",
      "...KKMMMMMMKK...",
      "..KKMKKMMKKMKK..",
      "..KMMEMMMMEMMK..",
      "..KMMMMMmMMMMK..",
      "..EMMMMMmMMMMK..",
      "..KKMKKKKKKMKK..",
      "...KKKKmmKKKK...",
      "....KKKKKKKK....",
      ".jjjjMKKKKMJJJJ.",
      "jjjjjjMMMMJJJJJJ",
      "jjjjjjJMMJJJJJJJ",
      "jjjjjjJJJJJJJJJJ",
    ],
    colors: { E: "#1a1a20", J: "#2e6ac0", K: "#3e3354", M: "#a86e48", j: "#3e8e5a", k: "#5e5080", m: "#8a5638" },
  },
  {
    label: "Viper",
    rows: [
      "....KKKKKKKK....",
      "...KKKKKKKKKK...",
      "..KKkkKKKKkkKK..",
      "..KKKKKSSSSSKK..",
      "..KKKSSSSSSSKK..",
      "..KKSKKSSKKSKK..",
      "..KKSESSSSESKK..",
      "..KKNNNNNNNNKK..",
      "..KKNnNNNNnNKK..",
      "..KKNNNOONNNKK..",
      "..KKKNNNNNNKKK..",
      "..KKKKGTTGKKKK..",
      ".TTKKTGTTGTKKTT.",
      "TTTTTTTGGTTTTTTT",
      "TTTTTTTTTTTTTTTT",
      "TTTTTTTTTTTTTTTT",
    ],
    colors: { E: "#5fd06a", G: "#6fe04a", K: "#33364a", N: "#454a58", O: "#c9a050", S: "#ebc3a8", T: "#3a3846", k: "#565c80", n: "#666c80" },
  },
];

export const AVATAR_SIZE = 16;
export const AVATAR_IDS = LOOKS.map((_, index) => String(index + 1));
export const DEFAULT_AVATAR = AVATAR_IDS[0];

export function isAvatarId(value: unknown): value is string {
  return typeof value === "string" && AVATAR_IDS.includes(value);
}

export function avatarPixels(id: string) {
  const look = LOOKS[Math.max(0, AVATAR_IDS.indexOf(id))];
  const pixels: { x: number; y: number; color: string }[] = [];
  look.rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const color = look.colors[cell];
      if (color) pixels.push({ x, y, color });
    });
  });
  return { label: look.label, pixels };
}

// Cheeky condolence lines for a prediction not matching the current live score.
// Pick is deterministic per seed (e.g. prediction id) so it doesn't flicker.
export const LOSE_MSGS = [
  "Lêu lêu, tạch rồi 😝",
  "Chúc may mắn lần sau 🤣",
  "Trật lất luôn 😬",
  "Còn lâu mới trúng 😆",
  "Sai một li, đi quỹ luôn 😎",
  "Hẹn trận sau nha 🙃",
  "Tiền sắp vào quỹ rồi 💸",
];

export function loseMessage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return LOSE_MSGS[h % LOSE_MSGS.length];
}

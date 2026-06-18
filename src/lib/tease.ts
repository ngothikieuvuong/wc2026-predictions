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
  "Đoán kiểu này thì nuôi quỹ cả mùa 🤡",
  "Thôi xong, cúng quỹ tập 2 😭",
  "Nhụt rồi, tiếc ghê chưa 🫠",
  "Tỉ số này chắc đoán cho vui 😏",
  "Cao thủ dự đoán… hụt 🥲",
  "Quỹ cảm ơn lòng hảo tâm 🙏",
  "Lại góp gạo nuôi quỹ rồi 🍚",
  "Trượt vỏ chuối ngọt xớt 🍌",
  "Nhà tiên tri tập sự đây rồi 🔮",
  "Đoán xa quá, gần lại chút đi 😅",
  "Tạch nhẹ nhàng mà đau 💀",
  "20k bay màu nha 🦋",
  "Sai số sai cả niềm tin 😩",
];

export function loseMessage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return LOSE_MSGS[h % LOSE_MSGS.length];
}

// Shown (red, highlighted) when EVERY prediction on a match misses the live
// score — the pot looks set to carry over and grow.
export const ALL_MISS_MSGS = [
  "Quỹ lại tăng rồi, dè de 😈",
  "Cả nhà tạch, quỹ phình to 🤑",
  "Chưa ai trúng, quỹ lại dày thêm 😏",
  "Quỹ nay lại béo, dè de 🤭",
  "Toang tập thể, quỹ cười khành khạch 😹",
  "Cả làng trượt, quỹ lên hương 🚀",
  "Không một ai, quỹ ăn trọn 🐷",
  "Đoán đông mà chẳng ai trúng 🤦",
  "Quỹ: cảm ơn tất cả 💰",
  "Một mùa bội thu cho… quỹ 🌾",
  "Cả hội cúng quỹ, vui phết 🎁",
];

export function allMissMessage(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ALL_MISS_MSGS[h % ALL_MISS_MSGS.length];
}

// Shown (green, highlighted) when someone's prediction matches the live score.
// "{n}" is replaced with the winners' names.
export const WIN_MSGS = [
  "🎉 Chúc mừng {n}, đang trúng tỉ số!",
  "🔥 {n} đang trúng, đỉnh thật!",
  "💰 {n} sắp ẵm quỹ tới nơi!",
  "🥳 {n} đang dẫn, quá ngon!",
  "🧠 Nhà tiên tri {n} xuất hiện!",
  "🎯 {n} bắn trúng phóc luôn!",
  "👑 {n} đang là ông/bà hoàng tỉ số!",
  "🚀 {n} bay thẳng tới quỹ!",
  "😎 {n} đoán như thần, nể!",
  "🍀 {n} hôm nay đỏ quá đỏ!",
  "💵 Quỹ đang gọi tên {n}!",
  "⭐ {n} đỉnh của chóp!",
];

export function winMessage(seed: string, names: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return WIN_MSGS[h % WIN_MSGS.length].replace("{n}", names.join(", "));
}

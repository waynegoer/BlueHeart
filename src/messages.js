// 祝福留言：纯前端，存 localStorage。

const KEY = 'blueheart.messages';
const MAX = 200;

export function loadWishes() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveWish(text) {
  const clean = String(text).trim().slice(0, 24);
  if (!clean) return null;
  const wishes = loadWishes();
  const entry = { text: clean, at: Date.now() };
  wishes.push(entry);
  while (wishes.length > MAX) wishes.shift();
  localStorage.setItem(KEY, JSON.stringify(wishes));
  return entry;
}

export function clearWishes() {
  localStorage.removeItem(KEY);
}

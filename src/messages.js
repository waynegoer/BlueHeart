// 祝福留言：优先走 Cloudflare Worker（存到 GitHub Issues），
// 未配置 Worker 时回退到浏览器 localStorage。
// 统一数据形状：{ id, text, at }
import { WISHES_API } from './config.js';

export const isRemote = () => !!WISHES_API;

// ---------- 远程：Worker → GitHub Issues ----------
async function remoteLoad() {
  const res = await fetch(`${WISHES_API}/wishes`);
  if (!res.ok) throw new Error(`加载失败 (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.wishes) ? data.wishes : [];
}

async function remoteSave(text) {
  const res = await fetch(`${WISHES_API}/wishes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`发送失败 (${res.status})`);
  const data = await res.json();
  return data.wish;
}

async function remoteDelete(id, key) {
  const res = await fetch(`${WISHES_API}/wishes/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': key },
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
  return true;
}

// ---------- 本地回退：localStorage ----------
const LS_KEY = 'blueheart.messages';

function localLoad() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function localSave(text) {
  const arr = localLoad();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    at: Date.now(),
  };
  arr.push(entry);
  while (arr.length > 200) arr.shift();
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  return entry;
}

function localDelete(id) {
  const arr = localLoad().filter((w) => String(w.id) !== String(id));
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
  return true;
}

// ---------- 对外统一接口（均为异步）----------
export async function loadWishes() {
  return isRemote() ? remoteLoad() : localLoad();
}

export async function saveWish(text) {
  const clean = String(text).trim().slice(0, 24);
  if (!clean) return null;
  return isRemote() ? remoteSave(clean) : localSave(clean);
}

export async function deleteWish(id, key) {
  return isRemote() ? remoteDelete(id, key) : localDelete(id);
}

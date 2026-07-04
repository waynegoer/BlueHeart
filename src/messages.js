// 祝福留言：优先走 Cloudflare Worker（存到 GitHub Issues），
// 未配置 Worker 时回退到浏览器 localStorage。
// 数据形状：{ id, text, meta:{x,y,size}, at }
//   meta.x, meta.y ∈ [0,1]（相对视口的位置），meta.size 为字号(px)
import { WISHES_API } from './config.js';

export const isRemote = () => !!WISHES_API;

// 新祝福默认排布：大爱心中心偏上区域随机落点。
export function defaultMeta() {
  return {
    x: +(0.36 + Math.random() * 0.28).toFixed(3),
    y: +(0.3 + Math.random() * 0.26).toFixed(3),
    size: 16,
  };
}

// 无排版信息的旧祝福：按 id 生成稳定位置（刷新不乱跳）。
export function stableMeta(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const rx = (h % 1000) / 1000;
  const ry = ((h >>> 10) % 1000) / 1000;
  return { x: +(0.32 + rx * 0.36).toFixed(3), y: +(0.28 + ry * 0.34).toFixed(3), size: 16 };
}

function withMeta(w) {
  return { ...w, meta: w.meta || stableMeta(w.id) };
}

// ---------- 远程：Worker → GitHub Issues ----------
async function remoteLoad() {
  const res = await fetch(`${WISHES_API}/wishes`);
  if (!res.ok) throw new Error(`加载失败 (${res.status})`);
  const data = await res.json();
  return (Array.isArray(data.wishes) ? data.wishes : []).map(withMeta);
}

async function remoteSave(text, meta) {
  const res = await fetch(`${WISHES_API}/wishes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, meta }),
  });
  if (!res.ok) throw new Error(`发送失败 (${res.status})`);
  const data = await res.json();
  return withMeta(data.wish);
}

async function remoteUpdate(id, text, meta, key) {
  const res = await fetch(`${WISHES_API}/wishes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ text, meta }),
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`保存失败 (${res.status})`);
  const data = await res.json();
  return withMeta(data.wish);
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

async function remoteVerify(key) {
  const res = await fetch(`${WISHES_API}/verify`, { headers: { 'x-admin-key': key } });
  return res.ok;
}

// ---------- 本地回退：localStorage ----------
const LS_KEY = 'blueheart.messages';

function localAll() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function localWrite(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

function localSave(text, meta) {
  const arr = localAll();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    meta,
    at: Date.now(),
  };
  arr.push(entry);
  while (arr.length > 200) arr.shift();
  localWrite(arr);
  return withMeta(entry);
}
function localUpdate(id, text, meta) {
  const arr = localAll();
  const w = arr.find((x) => String(x.id) === String(id));
  if (w) {
    w.text = text;
    w.meta = meta;
  }
  localWrite(arr);
  return withMeta(w || { id, text, meta, at: Date.now() });
}
function localDelete(id) {
  localWrite(localAll().filter((w) => String(w.id) !== String(id)));
  return true;
}

// ---------- 对外统一接口（均为异步）----------
export async function loadWishes() {
  return isRemote() ? remoteLoad() : localAll().map(withMeta);
}

export async function saveWish(text, meta) {
  const clean = String(text).trim().slice(0, 24);
  if (!clean) return null;
  const m = meta || defaultMeta();
  return isRemote() ? remoteSave(clean, m) : localSave(clean, m);
}

export async function updateWish(id, text, meta, key) {
  return isRemote() ? remoteUpdate(id, text, meta, key) : localUpdate(id, text, meta);
}

export async function deleteWish(id, key) {
  return isRemote() ? remoteDelete(id, key) : localDelete(id);
}

// 校验管理口令；本地模式恒为真。
export async function verifyAdmin(key) {
  return isRemote() ? remoteVerify(key) : true;
}

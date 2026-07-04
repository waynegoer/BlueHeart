// BlueHeart 祝福代理 —— Cloudflare Worker
// 用一个专用 GitHub Issue 的“评论”当作祝福留言板。每条评论保存一条祝福，
// 评论正文里额外用 HTML 注释编码排版信息 {x, y, size}（位置与字号）。
//
//   GET    /wishes         列出全部祝福（含排版信息）
//   POST   /wishes         新增祝福（任何人）  body: { text, meta? }
//   PATCH  /wishes/:id     更新祝福文字/排版（需管理口令） body: { text, meta }
//   DELETE /wishes/:id     删除祝福（需管理口令）
//   GET    /verify         校验管理口令（需 header x-admin-key）
//
// 机密（wrangler secret put）：GITHUB_TOKEN、ADMIN_KEY
// 变量（wrangler.toml [vars]）：GITHUB_REPO、ISSUE_NUMBER、ALLOW_ORIGIN

const GH = 'https://api.github.com';
const META_RE = /\n*<!--\s*bh:(\{[\s\S]*?\})\s*-->\s*$/;

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  });
}

async function gh(env, path, init = {}) {
  return fetch(GH + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'BlueHeart-Wishes-Worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 规整祝福文本：合并空白、去掉可能刷通知的 @、限长。
function sanitize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/@/g, '＠')
    .slice(0, 60);
}

// 规范化排版信息；非法返回 null。
function normMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const x = clamp(Number(meta.x), 0, 1);
  const y = clamp(Number(meta.y), 0, 1);
  const size = clamp(Number(meta.size), 8, 80);
  if ([x, y, size].some((v) => Number.isNaN(v))) return null;
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, size: Math.round(size) };
}

// 评论正文 = 可见文字 + 排版注释
function composeBody(text, meta) {
  const t = sanitize(text);
  const nm = normMeta(meta);
  return nm ? `${t}\n\n<!-- bh:${JSON.stringify(nm)} -->` : t;
}

// 从评论正文解析出 { text, meta }
function parseBody(body) {
  const src = String(body || '');
  const m = src.match(META_RE);
  if (!m) return { text: src.trim(), meta: null };
  let meta = null;
  try {
    meta = normMeta(JSON.parse(m[1]));
  } catch {
    meta = null;
  }
  return { text: src.slice(0, m.index).trim(), meta };
}

function commentToWish(c) {
  const { text, meta } = parseBody(c.body);
  return { id: c.id, text, meta, at: Date.parse(c.created_at) };
}

function adminOk(request, env) {
  const key = request.headers.get('x-admin-key') || '';
  return env.ADMIN_KEY && key === env.ADMIN_KEY;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.ISSUE_NUMBER) {
      return json({ error: 'worker not configured' }, 500, env);
    }

    const repo = env.GITHUB_REPO;
    const issue = env.ISSUE_NUMBER;

    try {
      // 校验管理口令
      if (request.method === 'GET' && pathname === '/verify') {
        return adminOk(request, env)
          ? json({ ok: true }, 200, env)
          : json({ ok: false }, 401, env);
      }

      // 列出祝福
      if (request.method === 'GET' && pathname === '/wishes') {
        const wishes = [];
        for (let page = 1; page <= 5; page++) {
          const res = await gh(
            env,
            `/repos/${repo}/issues/${issue}/comments?per_page=100&page=${page}`
          );
          if (!res.ok) {
            return json({ error: 'github error', detail: await res.text() }, 502, env);
          }
          const arr = await res.json();
          for (const c of arr) wishes.push(commentToWish(c));
          if (arr.length < 100) break;
        }
        return json({ wishes }, 200, env);
      }

      // 新增祝福（任何人）
      if (request.method === 'POST' && pathname === '/wishes') {
        const body = await request.json().catch(() => ({}));
        const text = sanitize(body.text);
        if (!text) return json({ error: 'empty text' }, 400, env);
        const res = await gh(env, `/repos/${repo}/issues/${issue}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: composeBody(text, body.meta) }),
        });
        if (!res.ok) {
          return json({ error: 'github error', detail: await res.text() }, 502, env);
        }
        return json({ wish: commentToWish(await res.json()) }, 201, env);
      }

      // 更新祝福（管理员）—— 主要用于保存拖拽/缩放后的排版
      const idMatch = pathname.match(/^\/wishes\/(\d+)$/);
      if (request.method === 'PATCH' && idMatch) {
        if (!adminOk(request, env)) return json({ error: 'unauthorized' }, 401, env);
        const body = await request.json().catch(() => ({}));
        const text = sanitize(body.text);
        if (!text) return json({ error: 'empty text' }, 400, env);
        const res = await gh(env, `/repos/${repo}/issues/comments/${idMatch[1]}`, {
          method: 'PATCH',
          body: JSON.stringify({ body: composeBody(text, body.meta) }),
        });
        if (!res.ok) {
          return json({ error: 'github error', detail: await res.text() }, 502, env);
        }
        return json({ wish: commentToWish(await res.json()) }, 200, env);
      }

      // 删除祝福（管理员）
      if (request.method === 'DELETE' && idMatch) {
        if (!adminOk(request, env)) return json({ error: 'unauthorized' }, 401, env);
        const res = await gh(env, `/repos/${repo}/issues/comments/${idMatch[1]}`, {
          method: 'DELETE',
        });
        if (res.status !== 204) {
          return json({ error: 'github error', detail: await res.text() }, 502, env);
        }
        return json({ ok: true }, 200, env);
      }

      return json({ error: 'not found' }, 404, env);
    } catch (e) {
      return json({ error: 'server', detail: String(e) }, 500, env);
    }
  },
};

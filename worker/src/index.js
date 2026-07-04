// BlueHeart 祝福代理 —— Cloudflare Worker
// 用一个专用 GitHub Issue 的“评论”当作祝福留言板：
//   GET    /wishes         列出全部祝福
//   POST   /wishes  {text} 新增一条祝福（任何人）
//   DELETE /wishes/:id     删除一条祝福（需管理口令 x-admin-key）
//
// 机密（wrangler secret put）：
//   GITHUB_TOKEN  fine-grained PAT，对目标仓库有 Issues 读写权限
//   ADMIN_KEY     删除所需的管理口令
// 变量（wrangler.toml [vars] 或面板）：
//   GITHUB_REPO   例如 "waynegoer/BlueHeart"
//   ISSUE_NUMBER  作为留言板的 issue 编号，例如 "1"
//   ALLOW_ORIGIN  允许的前端来源，默认 "*"

const GH = 'https://api.github.com';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
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

// 规整祝福文本：合并空白、去掉可能刷通知的 @、限长。
function sanitize(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/@/g, '＠')
    .slice(0, 60);
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
          for (const c of arr) {
            wishes.push({ id: c.id, text: c.body, at: Date.parse(c.created_at) });
          }
          if (arr.length < 100) break;
        }
        return json({ wishes }, 200, env);
      }

      // 新增祝福
      if (request.method === 'POST' && pathname === '/wishes') {
        const body = await request.json().catch(() => ({}));
        const text = sanitize(body.text);
        if (!text) return json({ error: 'empty text' }, 400, env);
        const res = await gh(env, `/repos/${repo}/issues/${issue}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        });
        if (!res.ok) {
          return json({ error: 'github error', detail: await res.text() }, 502, env);
        }
        const c = await res.json();
        return json(
          { wish: { id: c.id, text: c.body, at: Date.parse(c.created_at) } },
          201,
          env
        );
      }

      // 删除祝福（需管理口令）
      const m = pathname.match(/^\/wishes\/(\d+)$/);
      if (request.method === 'DELETE' && m) {
        const key = request.headers.get('x-admin-key') || '';
        if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
          return json({ error: 'unauthorized' }, 401, env);
        }
        const res = await gh(env, `/repos/${repo}/issues/comments/${m[1]}`, {
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

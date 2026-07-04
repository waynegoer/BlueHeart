# BlueHeart 祝福代理（Cloudflare Worker）

让静态站点安全地把祝福保存到 **GitHub Issues**：Worker 保管 GitHub Token，
前端只与 Worker 通信。祝福 = 某个专用 Issue 下的一条条评论。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/wishes` | 列出全部祝福 |
| `POST` | `/wishes`  body `{ "text": "..." }` | 新增祝福（任何人） |
| `DELETE` | `/wishes/:id` header `x-admin-key: <口令>` | 删除祝福（仅管理员） |

## 一次性部署步骤

### 1. 建一个“留言板” Issue
在 <https://github.com/waynegoer/BlueHeart/issues> 新建一个 Issue（标题如 “祝福墙 / Wishes”），
记下它的编号（URL 末尾数字，如 `#1`）。祝福会作为该 Issue 的评论保存。

### 2. 创建 fine-grained Personal Access Token
GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token：
- **Repository access**：只选 `waynegoer/BlueHeart`
- **Permissions → Repository → Issues**：**Read and write**
- 生成后复制备用（只显示一次）。

### 3. 部署 Worker
```bash
cd worker
npm install
npx wrangler login                 # 浏览器授权 Cloudflare
# 如 issue 编号不是 1，改 wrangler.toml 里的 ISSUE_NUMBER
npx wrangler secret put GITHUB_TOKEN   # 粘贴第 2 步的 token
npx wrangler secret put ADMIN_KEY      # 自定义一个删除口令
npx wrangler deploy
```
部署完成后会得到一个地址，如：
`https://blueheart-wishes.<你的账号>.workers.dev`

### 4. 告诉前端 Worker 地址
在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 新建变量：
- Name：`VITE_WISHES_API`
- Value：上一步的 Worker 地址

然后到 **Actions** 里重跑一次部署（或随便 push 一次），前端即接入该 Worker。
（本地开发想连线上 Worker，可在项目根建 `.env.local` 写 `VITE_WISHES_API=...`。）

> 未配置 `VITE_WISHES_API` 时，前端会自动回退到浏览器本地存储（localStorage），
> 站点仍可正常演示，只是祝福不上云、不跨设备共享。

## 收紧来源（可选）
上线稳定后，把 `wrangler.toml` 里的 `ALLOW_ORIGIN` 改为
`https://waynegoer.github.io` 再 `npx wrangler deploy`，只允许你的站点调用。

// Cloudflare Worker 祝福代理地址。
// 部署 worker/ 后，把地址填到仓库变量 VITE_WISHES_API（见 worker/README.md），
// 或本地开发时写进 .env.local。留空则前端回退到 localStorage。
// 容错处理：去掉首尾空白，以及结尾多余的斜杠/点号（常见手滑）。
export const WISHES_API = (import.meta.env.VITE_WISHES_API || '')
  .trim()
  .replace(/[./\s]+$/, '');

# 💙 BlueHeart

一颗**由许多小蓝色爱心组成的大蓝色爱心** —— 基于 Canvas 粒子动画的单页应用（SPA）。

在线预览：<https://waynegoer.github.io/BlueHeart/>

## ✨ 功能

- **爱心由爱心组成**：数百颗小蓝爱心按心形数学曲线聚拢，构成一颗大爱心。
- **心跳动画**：整颗爱心以 “lub-dub” 双段节律脉动，小爱心随机闪烁浮动。
- **送祝福 / 留言（存到 GitHub）**：写一句话，一颗带文字的高亮小爱心飞入大爱心；祝福通过 Cloudflare Worker 保存到 **GitHub Issues**，跨设备共享，可在“祝福墙”查看与删除（删除需管理口令）。未配置 Worker 时自动回退到本地 localStorage。部署见 [worker/README.md](worker/README.md)。
- **多种蓝色主题**：深海蓝 / 天空蓝 / 蓝紫渐变 / 浅色冰蓝，随点随换，记住选择。
- **点击互动**：点击或触摸画面，附近小爱心散开后再缓缓归位。
- **一键分享**：截图当前画面为 PNG，移动端支持系统分享，桌面端下载图片。

## 🛠️ 技术栈

- Vite + 原生 JavaScript（零框架）
- HTML5 Canvas 2D + `requestAnimationFrame`
- localStorage 持久化祝福与主题
- 支持 `prefers-reduced-motion`（降级为静态展示）

## 🚀 本地运行

```bash
npm install
npm run dev      # 打开终端提示的本地地址
```

构建与本地预览生产版本：

```bash
npm run build
npm run preview
```

## 📦 部署（GitHub Pages）

已内置 GitHub Actions 工作流 `.github/workflows/deploy.yml`：

1. 推送到 `main` 分支后自动构建并发布 `dist/`。
2. **首次需手动开启一次**：仓库 **Settings → Pages → Build and deployment → Source** 选择 **“GitHub Actions”**。
3. 部署完成后访问 <https://waynegoer.github.io/BlueHeart/>。

> `vite.config.js` 中的 `base: '/BlueHeart/'` 与仓库名对应，切勿改动，否则子路径下资源会 404。

## 📁 项目结构

```
src/
├─ main.js       入口装配
├─ heart.js      心形几何与目标点采样
├─ particle.js   粒子类 + 小爱心 sprite 预渲染
├─ scene.js      渲染循环 / 心跳 / 点击 / 祝福飞入 / 截图
├─ theme.js      蓝色调色板与主题切换
├─ messages.js   祝福留言（Worker→GitHub Issues，回退 localStorage）
├─ config.js     Worker 地址配置（VITE_WISHES_API）
├─ ui.js         控件绑定（含删除）
└─ style.css     布局与样式
worker/          Cloudflare Worker 祝福代理（见 worker/README.md）
```

---

用 💙 与 Canvas 制作。

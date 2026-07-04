// Canvas 场景：渲染循环、心跳、点击互动、resize、祝福小爱心飞入、截图。
import { generateHeartPoints } from './heart.js';
import { Particle, makeHeartSprite } from './particle.js';
import { getPalette } from './theme.js';

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.sprites = [];
    this.cx = 0;
    this.cy = 0;
    this.time = 0;
    this.pointer = null;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get cssWidth() {
    return this.canvas.clientWidth;
  }
  get cssHeight() {
    return this.canvas.clientHeight;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);

    const { points, scale, cx, cy } = generateHeartPoints(w, h);
    this.cx = cx;
    this.cy = cy;
    this.baseScale = scale;

    // 保留粒子数量的连续性：重建，但尽量复用现有位置以避免闪烁
    const old = this.particles;
    this.particles = points.map((p, i) => {
      const part = new Particle(p.x, p.y);
      if (old[i]) {
        part.x = old[i].x;
        part.y = old[i].y;
        part.sizeScale = old[i].sizeScale;
        part.shade = old[i].shade;
        part.spriteIndex = old[i].spriteIndex;
        part.phase = old[i].phase;
      }
      return part;
    });

    this.baseSize = Math.max(6, scale * 0.9); // 单颗小爱心的基础像素尺寸
    this._buildSprites();
  }

  setPalette(paletteId) {
    this.paletteId = paletteId;
    this._buildSprites();
  }

  _buildSprites() {
    const palette = getPalette(this.paletteId);
    const spritePx = Math.ceil(this.baseSize * 2 * this.dpr);
    this.sprites = palette.shades.map((c) =>
      makeHeartSprite(spritePx, c, palette.glow)
    );
    this.spritePx = spritePx;
  }

  _bindPointer() {
    const onDown = (e) => {
      const p = this._eventPos(e);
      this.pointer = { ...p, life: 1 };
    };
    this.canvas.addEventListener('pointerdown', onDown);
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.pointer) this.pointer = { ...this._eventPos(e), life: this.pointer.life };
    });
  }

  _eventPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * this.dpr,
      y: (e.clientY - rect.top) * this.dpr,
    };
  }

  _beatScale() {
    if (this.reduceMotion) return 1;
    // 模拟 lub-dub 双段心跳，周期约 1.1s
    const period = 1.1;
    const t = (this.time % period) / period;
    let beat = 0;
    beat += Math.exp(-((t - 0.0) ** 2) / 0.004) * 0.06;
    beat += Math.exp(-((t - 0.16) ** 2) / 0.006) * 0.04;
    return 1 + beat;
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this._step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _step(dt) {
    const ctx = this.ctx;

    // 背景
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const beat = this._beatScale();

    // 点击斥力衰减
    if (this.pointer) {
      this.pointer.life -= dt * 1.6;
      if (this.pointer.life <= 0) this.pointer = null;
    }

    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.particles) {
      // 以 CSS 坐标计算，再乘 dpr 绘制
      p.update(dt, beat, this.cx, this.cy);
      if (this.pointer && this.pointer.life > 0) {
        p.repel(
          this.pointer.x / this.dpr,
          this.pointer.y / this.dpr,
          120,
          6 * this.pointer.life
        );
      }

      const sprite = this.sprites[p.spriteIndex] || this.sprites[0];
      const tw = this.reduceMotion ? 1 : 0.7 + Math.sin(p.phase) * 0.3 * p.twinkle;
      const drawPx = this.baseSize * p.sizeScale * this.dpr * 1.4;
      ctx.globalAlpha = 0.55 + tw * 0.45;
      ctx.drawImage(
        sprite,
        p.x * this.dpr - drawPx / 2,
        p.y * this.dpr - drawPx / 2,
        drawPx,
        drawPx
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // 生成分享用的 PNG（背景 + 爱心 + 祝福文字贴纸 + 水印）
  toShareBlob(wishes = []) {
    return new Promise((resolve) => {
      const palette = getPalette(this.paletteId);
      const out = document.createElement('canvas');
      out.width = this.canvas.width;
      out.height = this.canvas.height;
      const c = out.getContext('2d');
      // 背景渐变
      const g = c.createLinearGradient(0, 0, 0, out.height);
      g.addColorStop(0, palette.bg[0]);
      g.addColorStop(1, palette.bg[1]);
      c.fillStyle = g;
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(this.canvas, 0, 0);

      // 祝福文字贴纸（按各自位置与字号）
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (const w of wishes) {
        if (!w.meta) continue;
        const px = w.meta.x * out.width;
        const py = w.meta.y * out.height;
        const fs = w.meta.size * this.dpr;
        c.font = `600 ${Math.round(fs)}px system-ui, sans-serif`;
        c.fillStyle = palette.accent;
        c.shadowColor = palette.glow;
        c.shadowBlur = fs * 0.6;
        c.fillText('💙 ' + w.text, px, py);
        c.shadowBlur = 0;
      }

      // 水印
      c.fillStyle = palette.text;
      c.globalAlpha = 0.7;
      c.font = `${Math.round(16 * this.dpr)}px system-ui, sans-serif`;
      c.fillText('BlueHeart 💙', out.width / 2, out.height - 24 * this.dpr);
      out.toBlob((b) => resolve(b), 'image/png');
    });
  }
}

// 小爱心粒子，以及离屏预渲染的心形 sprite。

// 心形路径（两段贝塞尔），中心在原点，供 sprite 预渲染使用。
function heartShape(ctx, size) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(s * 0.55, -s * 0.25, s * 0.55, -s * 0.75, 0, -s * 0.35);
  ctx.bezierCurveTo(-s * 0.55, -s * 0.75, -s * 0.55, -s * 0.25, 0, s * 0.35);
  ctx.closePath();
}

/**
 * 预渲染一张小爱心 sprite（含发光），返回离屏 canvas。
 * @param {number} px  sprite 边长（设备像素）
 * @param {string} color 填充色（含主题蓝）
 */
export function makeHeartSprite(px, color, glow) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.translate(px / 2, px / 2);
  const size = px * 0.62;

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = px * 0.28;
  }
  ctx.fillStyle = color;
  heartShape(ctx, size);
  ctx.fill();

  // 高光
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.16, -size * 0.2, size * 0.12, size * 0.08, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  return canvas;
}

export function drawHeartPath(ctx, size) {
  heartShape(ctx, size);
}

export class Particle {
  constructor(homeX, homeY) {
    this.homeX = homeX;
    this.homeY = homeY;
    // 入场：从画面外随机散点飞入
    const ang = Math.random() * Math.PI * 2;
    const r = 1.1;
    this.x = homeX + Math.cos(ang) * 1200 * r * Math.random();
    this.y = homeY + Math.sin(ang) * 1200 * r * Math.random();
    this.vx = 0;
    this.vy = 0;
    this.sizeScale = 0.75 + Math.random() * 0.6; // 每颗略有大小差异
    this.shade = Math.random(); // 0..1，用于选择深浅色阶
    this.phase = Math.random() * Math.PI * 2; // 闪烁/浮动相位
    this.twinkle = 0.5 + Math.random() * 0.5;
    this.spriteIndex = Math.floor(this.shade * 4); // 对应 4 档色阶 sprite
  }

  // 朝 home（可叠加心跳缩放偏移）做弹性缓动，并施加外力（点击斥力）。
  update(dt, beatScale, cx, cy) {
    // 心跳：整组以中心为基准缩放
    const tx = cx + (this.homeX - cx) * beatScale;
    const ty = cy + (this.homeY - cy) * beatScale;

    const stiffness = 0.055;
    const damping = 0.82;
    this.vx += (tx - this.x) * stiffness;
    this.vy += (ty - this.y) * stiffness;
    this.vx *= damping;
    this.vy *= damping;
    this.x += this.vx;
    this.y += this.vy;
    this.phase += dt * 2 * this.twinkle;
  }

  // 点击/触摸：径向斥力
  repel(mx, my, radius, strength) {
    const dx = this.x - mx;
    const dy = this.y - my;
    const d2 = dx * dx + dy * dy;
    const r2 = radius * radius;
    if (d2 < r2 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const force = (1 - d / radius) * strength;
      this.vx += (dx / d) * force;
      this.vy += (dy / d) * force;
    }
  }
}

// 外围飘散粒子：从轮廓向外扩散并带上飘，自转、淡出后回收。全部以 CSS 坐标计算。
export class Drifter {
  constructor() {
    this.dead = true;
  }

  // 在给定轮廓点复活，初速朝“由中心指向该点”的向外方向 + 上飘偏置。
  reset(pt, cx, cy, baseSize) {
    this.x = pt.x;
    this.y = pt.y;
    let nx = pt.x - cx;
    let ny = pt.y - cy;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const speed = 15 + Math.random() * 25; // 向外 15~40 px/s
    this.vx = nx * speed;
    this.vy = ny * speed - (10 + Math.random() * 15); // 叠加上飘
    this.maxLife = 3.5 + Math.random() * 3; // 3.5~6.5s
    this.life = this.maxLife;
    this.sizeScale = 0.45 + Math.random() * 0.5;
    this.baseSize = baseSize;
    this.rot = Math.random() * Math.PI * 2;
    this.vrot = (Math.random() - 0.5) * 1.2;
    this.spriteIndex = Math.floor(Math.random() * 4);
    this.swayAmp = 6 + Math.random() * 10;
    this.swayFreq = 0.6 + Math.random() * 0.8;
    this.seed = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vx *= 0.99; // 轻微阻尼
    this.vy = this.vy * 0.99 - 4 * dt; // 持续上飘
    const age = this.maxLife - this.life;
    const sway = Math.cos(age * this.swayFreq + this.seed) * this.swayAmp * dt;
    this.x += this.vx * dt + sway;
    this.y += this.vy * dt;
    this.rot += this.vrot * dt;
  }

  // 透明度：前 0.4s 渐入，随后随剩余寿命淡出。
  get alpha() {
    const age = this.maxLife - this.life;
    const fadeIn = Math.min(1, age / 0.4);
    const fadeOut = Math.min(1, this.life / (this.maxLife * 0.6));
    return fadeIn * fadeOut;
  }
}

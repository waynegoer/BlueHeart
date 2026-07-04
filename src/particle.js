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

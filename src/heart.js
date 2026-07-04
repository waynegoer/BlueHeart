// 心形几何：生成大爱心内部的目标点，每个点即一颗小爱心粒子的归位坐标。

// 经典心形参数方程（数学课本那颗爱心）。
// 返回以 (0,0) 为中心的坐标，y 轴向上；渲染时再翻转/缩放。
export function heartPoint(t) {
  const x = 16 * Math.sin(t) ** 3;
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  return { x, y };
}

// 判断某点是否落在心形轮廓内部（射线法：用一圈轮廓点构成多边形）。
function buildOutline(samples = 240) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    pts.push(heartPoint(t));
  }
  return pts;
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 生成填满心形内部的目标点集合。
 * @param {number} width  画布 CSS 宽度
 * @param {number} height 画布 CSS 高度
 * @returns {{points: Array<{x:number,y:number}>, scale:number, cx:number, cy:number}}
 */
export function generateHeartPoints(width, height) {
  const outline = buildOutline();

  // 心形原始范围约 x∈[-17,17], y∈[-17,13]。据画布定缩放，留边距。
  const spanX = 34;
  const spanY = 30;
  const margin = 0.82;
  const scale = Math.min((width * margin) / spanX, (height * margin) / spanY);
  const cx = width / 2;
  const cy = height / 2;

  // 网格步长随画布尺寸自适应，控制粒子数量在数百到近千之间。
  const step = Math.max(0.62, 30 / Math.sqrt((width * height) / 900));

  const points = [];
  for (let gy = -18; gy <= 15; gy += step) {
    for (let gx = -18; gx <= 18; gx += step) {
      if (pointInPolygon(gx, gy, outline)) {
        // 轻微抖动，避免过于规整的网格感。
        const jx = gx + (Math.random() - 0.5) * step * 0.6;
        const jy = gy + (Math.random() - 0.5) * step * 0.6;
        points.push({
          x: cx + jx * scale,
          y: cy - jy * scale, // 翻转 y：数学向上 → 屏幕向下
        });
      }
    }
  }

  return { points, scale, cx, cy };
}

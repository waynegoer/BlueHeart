// 蓝色主题调色板与切换。每套含：4 档小爱心色阶、发光色、高亮色、背景渐变、文字色。

const PALETTES = {
  deepsea: {
    name: '深海蓝',
    shades: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa'],
    glow: '#3b82f6',
    accent: '#93c5fd',
    text: '#dbeafe',
    bg: ['#050b1f', '#0a1a3f'],
  },
  sky: {
    name: '天空蓝',
    shades: ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc'],
    glow: '#38bdf8',
    accent: '#bae6fd',
    text: '#e0f2fe',
    bg: ['#071426', '#0c2740'],
  },
  violet: {
    name: '蓝紫渐变',
    shades: ['#4338ca', '#4f46e5', '#6366f1', '#818cf8'],
    glow: '#6366f1',
    accent: '#c7d2fe',
    text: '#e0e7ff',
    bg: ['#0b0722', '#1a1147'],
  },
  ice: {
    name: '浅色·冰蓝',
    shades: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
    glow: '#60a5fa',
    accent: '#2563eb',
    text: '#1e3a8a',
    bg: ['#eff6ff', '#dbeafe'],
  },
};

const ORDER = ['deepsea', 'sky', 'violet', 'ice'];
const STORE_KEY = 'blueheart.theme';

export function getPalette(id) {
  return PALETTES[id] || PALETTES.deepsea;
}

export function listPalettes() {
  return ORDER.map((id) => ({ id, ...PALETTES[id] }));
}

export function loadThemeId() {
  const saved = localStorage.getItem(STORE_KEY);
  return saved && PALETTES[saved] ? saved : 'deepsea';
}

export function saveThemeId(id) {
  localStorage.setItem(STORE_KEY, id);
}

// 应用背景/文字到页面 CSS 变量
export function applyThemeCss(id) {
  const p = getPalette(id);
  const root = document.documentElement;
  root.style.setProperty('--bg-top', p.bg[0]);
  root.style.setProperty('--bg-bottom', p.bg[1]);
  root.style.setProperty('--text', p.text);
  root.style.setProperty('--accent', p.accent);
  root.style.setProperty('--glow', p.glow);
  const light = id === 'ice';
  root.classList.toggle('theme-light', light);
}

// 循环切到下一套主题，返回新 id
export function nextThemeId(current) {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length];
}

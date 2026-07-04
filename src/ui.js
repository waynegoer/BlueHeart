// 控件绑定：祝福输入、主题切换、祝福墙、截图分享。
import {
  loadThemeId,
  saveThemeId,
  applyThemeCss,
  nextThemeId,
  getPalette,
} from './theme.js';
import { loadWishes, saveWish } from './messages.js';

export function initUI(scene) {
  // ---- 主题 ----
  let themeId = loadThemeId();
  applyThemeCss(themeId);
  scene.setPalette(themeId);

  const themeBtn = document.getElementById('theme-btn');
  themeBtn.addEventListener('click', () => {
    themeId = nextThemeId(themeId);
    saveThemeId(themeId);
    applyThemeCss(themeId);
    scene.setPalette(themeId);
    themeBtn.textContent = `🎨 ${getPalette(themeId).name}`;
    setTimeout(() => (themeBtn.textContent = '🎨 主题'), 1200);
  });

  // ---- 祝福输入 ----
  const form = document.getElementById('wish-form');
  const input = document.getElementById('wish-input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = saveWish(input.value);
    if (entry) {
      scene.addWish(entry.text);
      renderWishes();
      input.value = '';
      input.blur();
    }
  });

  // ---- 祝福墙抽屉 ----
  const panel = document.getElementById('wishes-panel');
  const list = document.getElementById('wishes-list');
  const empty = document.getElementById('wishes-empty');
  const wishesBtn = document.getElementById('wishes-btn');
  const closeBtn = document.getElementById('wishes-close');

  function renderWishes() {
    const wishes = loadWishes().slice().reverse();
    list.innerHTML = '';
    empty.hidden = wishes.length > 0;
    for (const w of wishes) {
      const li = document.createElement('li');
      const d = new Date(w.at);
      const stamp = `${d.getMonth() + 1}/${d.getDate()} ${String(
        d.getHours()
      ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      li.innerHTML = `<span class="w-heart">💙</span><span class="w-text"></span><time>${stamp}</time>`;
      li.querySelector('.w-text').textContent = w.text;
      list.appendChild(li);
    }
  }

  wishesBtn.addEventListener('click', () => {
    renderWishes();
    panel.hidden = false;
  });
  closeBtn.addEventListener('click', () => (panel.hidden = true));

  // ---- 分享 ----
  const shareBtn = document.getElementById('share-btn');
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    const prev = shareBtn.textContent;
    shareBtn.textContent = '⏳ 生成中';
    try {
      const blob = await scene.toShareBlob();
      const file = new File([blob], 'blueheart.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'BlueHeart 💙' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blueheart.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      // 用户取消分享等，静默处理
      console.debug('share cancelled', err);
    } finally {
      shareBtn.textContent = prev;
      shareBtn.disabled = false;
    }
  });

  // 首次加载时，把已存祝福轻轻飞入几颗（不刷屏）
  const existing = loadWishes().slice(-6);
  existing.forEach((w, i) => setTimeout(() => scene.addWish(w.text), 600 + i * 350));
}

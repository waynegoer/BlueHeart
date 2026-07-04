// 控件绑定：祝福输入、主题切换、祝福墙（增/删）、截图分享。
import {
  loadThemeId,
  saveThemeId,
  applyThemeCss,
  nextThemeId,
  getPalette,
} from './theme.js';
import { loadWishes, saveWish, deleteWish, isRemote } from './messages.js';

const ADMIN_KEY_STORE = 'blueheart.adminkey';

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
  const submitBtn = form.querySelector('.btn-primary');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value;
    if (!text.trim()) return;
    submitBtn.disabled = true;
    try {
      const entry = await saveWish(text);
      if (entry) {
        scene.addWish(entry.text);
        input.value = '';
        input.blur();
        if (!panel.hidden) renderWishes();
      }
    } catch (err) {
      alert('发送失败：' + (err.message || err));
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---- 祝福墙抽屉 ----
  const panel = document.getElementById('wishes-panel');
  const list = document.getElementById('wishes-list');
  const empty = document.getElementById('wishes-empty');
  const wishesBtn = document.getElementById('wishes-btn');
  const closeBtn = document.getElementById('wishes-close');

  function fmtTime(at) {
    const d = new Date(at);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
      2,
      '0'
    )}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function getAdminKey(force) {
    let k = sessionStorage.getItem(ADMIN_KEY_STORE) || '';
    if (!k || force) {
      k = window.prompt('请输入管理口令以删除祝福：') || '';
      if (k) sessionStorage.setItem(ADMIN_KEY_STORE, k);
    }
    return k;
  }

  async function handleDelete(wish, liEl) {
    let key = '';
    if (isRemote()) {
      key = getAdminKey();
      if (!key) return;
    }
    liEl.classList.add('removing');
    try {
      await deleteWish(wish.id, key);
      renderWishes();
    } catch (err) {
      liEl.classList.remove('removing');
      if (String(err.message) === 'unauthorized') {
        sessionStorage.removeItem(ADMIN_KEY_STORE);
        alert('管理口令错误，请重试。');
      } else {
        alert('删除失败：' + (err.message || err));
      }
    }
  }

  async function renderWishes() {
    list.innerHTML = '';
    empty.hidden = true;
    const loading = document.createElement('li');
    loading.className = 'wishes-loading';
    loading.textContent = '加载中…';
    list.appendChild(loading);

    let wishes;
    try {
      wishes = await loadWishes();
    } catch (err) {
      loading.textContent = '加载失败：' + (err.message || err);
      loading.classList.add('error');
      return;
    }

    list.innerHTML = '';
    wishes = wishes.slice().reverse(); // 新的在前
    empty.hidden = wishes.length > 0;

    for (const w of wishes) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="w-heart">💙</span><span class="w-text"></span><time>${fmtTime(
        w.at
      )}</time><button class="w-del" title="删除">🗑</button>`;
      li.querySelector('.w-text').textContent = w.text;
      li.querySelector('.w-del').addEventListener('click', () => handleDelete(w, li));
      list.appendChild(li);
    }
  }

  wishesBtn.addEventListener('click', () => {
    panel.hidden = false;
    renderWishes();
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
      console.debug('share cancelled', err);
    } finally {
      shareBtn.textContent = prev;
      shareBtn.disabled = false;
    }
  });

  // 首次加载：把已存祝福轻轻飞入几颗
  loadWishes()
    .then((list) => {
      list.slice(-6).forEach((w, i) =>
        setTimeout(() => scene.addWish(w.text), 600 + i * 350)
      );
    })
    .catch(() => {});
}

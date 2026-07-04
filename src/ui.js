// 控件绑定：祝福输入、主题、祝福贴纸层（拖拽/缩放/排版）、祝福墙（删除）、分享。
import {
  loadThemeId,
  saveThemeId,
  applyThemeCss,
  nextThemeId,
  getPalette,
} from './theme.js';
import {
  loadWishes,
  saveWish,
  updateWish,
  deleteWish,
  verifyAdmin,
  isRemote,
} from './messages.js';
import { WishesLayer } from './wishesLayer.js';

const ADMIN_KEY_STORE = 'blueheart.adminkey';

export function initUI(scene) {
  const getKey = () => sessionStorage.getItem(ADMIN_KEY_STORE) || '';

  function promptAdminKey(force) {
    let k = getKey();
    if (!k || force) {
      k = window.prompt('请输入管理口令：') || '';
      if (k) sessionStorage.setItem(ADMIN_KEY_STORE, k);
    }
    return k;
  }

  // ---- 祝福贴纸层 ----
  const layer = new WishesLayer(document.getElementById('wishes-layer'), async (wish) => {
    // 拖拽/缩放结束后保存排版
    try {
      return await updateWish(wish.id, wish.text, wish.meta, getKey());
    } catch (err) {
      if (String(err.message) === 'unauthorized') {
        sessionStorage.removeItem(ADMIN_KEY_STORE);
        exitEdit();
        alert('管理口令失效，已退出排版模式。');
      } else {
        alert('保存失败：' + (err.message || err));
      }
      return null;
    }
  });

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

  // ---- 排版（管理员）----
  const editBtn = document.getElementById('edit-btn');
  function exitEdit() {
    layer.setEditMode(false);
    editBtn.classList.remove('active');
    editBtn.textContent = '✏️ 排版';
  }
  editBtn.addEventListener('click', async () => {
    if (layer.editMode) {
      exitEdit();
      return;
    }
    const key = promptAdminKey();
    if (!key) return;
    editBtn.disabled = true;
    try {
      const ok = await verifyAdmin(key);
      if (!ok) {
        sessionStorage.removeItem(ADMIN_KEY_STORE);
        alert('管理口令错误。');
        return;
      }
      layer.setEditMode(true);
      editBtn.classList.add('active');
      editBtn.textContent = '✅ 完成排版';
    } catch (err) {
      alert('校验失败：' + (err.message || err));
    } finally {
      editBtn.disabled = false;
    }
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
        layer.add(entry, true); // 飞入并停留
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

  // ---- 祝福墙抽屉（删除）----
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

  async function handleDelete(wish, liEl) {
    let key = '';
    if (isRemote()) {
      key = promptAdminKey();
      if (!key) return;
    }
    liEl.classList.add('removing');
    try {
      await deleteWish(wish.id, key);
      layer.remove(wish.id);
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
    wishes = wishes.slice().reverse();
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

  // ---- 分享（把贴纸文字也画进截图）----
  const shareBtn = document.getElementById('share-btn');
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    const prev = shareBtn.textContent;
    shareBtn.textContent = '⏳ 生成中';
    try {
      const blob = await scene.toShareBlob(layer.getWishes());
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

  // ---- 首屏加载祝福并铺到贴纸层 ----
  loadWishes()
    .then((wishes) => layer.setWishes(wishes))
    .catch((err) => console.warn('加载祝福失败：', err));
}

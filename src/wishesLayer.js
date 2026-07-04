// 祝福贴纸层：把每条祝福渲染成停留在爱心上的 DOM 文字贴纸。
// 非编辑态：只展示、不拦截鼠标（爱心仍可点击）。
// 编辑态（管理员）：可拖拽移动、拖右下角手柄缩放/改字号，松手即保存。
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const capture = (el, id) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* 某些环境下无活动指针，忽略 */
  }
};
const release = (el, id) => {
  try {
    el.releasePointerCapture(id);
  } catch {
    /* 忽略 */
  }
};

export class WishesLayer {
  /**
   * @param {HTMLElement} root 覆盖在 canvas 上的全屏容器
   * @param {(wish:object)=>Promise} onLayoutChange 拖拽/缩放结束后的保存回调
   */
  constructor(root, onLayoutChange) {
    this.root = root;
    this.onLayoutChange = onLayoutChange;
    this.editMode = false;
    this.items = new Map(); // id -> { wish, el }
    root.classList.add('wishes-layer');
  }

  setEditMode(on) {
    this.editMode = on;
    this.root.classList.toggle('editing', on);
  }

  clear() {
    this.root.innerHTML = '';
    this.items.clear();
  }

  setWishes(list) {
    this.clear();
    for (const w of list) this.add(w, false);
  }

  getWishes() {
    return [...this.items.values()].map((it) => it.wish);
  }

  remove(id) {
    const it = this.items.get(String(id));
    if (it) {
      it.el.remove();
      this.items.delete(String(id));
    }
  }

  add(wish, flyIn) {
    const el = document.createElement('div');
    el.className = 'wish-sticker';
    el.dataset.id = wish.id;
    el.innerHTML =
      '<span class="ws-heart">💙</span><span class="ws-text"></span>' +
      '<span class="ws-handle" title="拖拽缩放 / 改字号"></span>';
    el.querySelector('.ws-text').textContent = wish.text;
    this.root.appendChild(el);

    const item = { wish: { ...wish }, el };
    this.items.set(String(wish.id), item);
    this._place(item);
    this._bindDrag(item);

    if (flyIn) {
      el.classList.add('flyin');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => el.classList.remove('flyin'))
      );
    }
    return item;
  }

  _place(item) {
    const { meta } = item.wish;
    item.el.style.left = meta.x * 100 + '%';
    item.el.style.top = meta.y * 100 + '%';
    item.el.style.fontSize = meta.size + 'px';
  }

  _bindDrag(item) {
    const el = item.el;
    const handle = el.querySelector('.ws-handle');

    // 移动整条祝福
    el.addEventListener('pointerdown', (e) => {
      if (!this.editMode || e.target === handle) return;
      e.preventDefault();
      capture(el, e.pointerId);
      el.classList.add('dragging');
      const rect = this.root.getBoundingClientRect();
      const move = (ev) => {
        item.wish.meta.x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        item.wish.meta.y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
        this._place(item);
      };
      const up = (ev) => {
        release(el, ev.pointerId);
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        this._save(item);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });

    // 缩放 / 改字号
    handle.addEventListener('pointerdown', (e) => {
      if (!this.editMode) return;
      e.preventDefault();
      e.stopPropagation();
      capture(handle, e.pointerId);
      el.classList.add('dragging');
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = item.wish.meta.size;
      const move = (ev) => {
        const delta = (ev.clientX - startX + (ev.clientY - startY)) * 0.15;
        item.wish.meta.size = Math.round(clamp(startSize + delta, 8, 80));
        this._place(item);
      };
      const up = (ev) => {
        release(handle, ev.pointerId);
        el.classList.remove('dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        this._save(item);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  async _save(item) {
    if (!this.onLayoutChange) return;
    item.el.classList.add('saving');
    try {
      const saved = await this.onLayoutChange(item.wish);
      if (saved) item.wish = { ...saved };
    } finally {
      item.el.classList.remove('saving');
    }
  }
}

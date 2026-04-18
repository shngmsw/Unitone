import { invoke } from '@tauri-apps/api/core';

// Keep in sync with layout.rs PANE_HEADER_HEIGHT
const PANE_HEADER_HEIGHT = 28;

export class PaneTreeManager {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.tree = null;
    this._dragState = null;
    this._animFrameId = null;

    document.addEventListener('mousemove', this._onDragMove.bind(this));
    document.addEventListener('mouseup', this._onDragEnd.bind(this));
  }

  async init() {
    this.container = document.getElementById('webview-container');
    try {
      this.tree = await invoke('get_service_tree');
      this._render();
    } catch (e) {
      console.error('[PaneTreeManager] init failed:', e);
    }
  }

  async refresh() {
    try {
      this.tree = await invoke('get_service_tree');
      this._render();
    } catch (e) {
      console.error('[PaneTreeManager] refresh failed:', e);
    }
  }

  _render() {
    if (!this.container || !this.tree) return;
    this.container.innerHTML = '';
    const el = this._buildNode(this.tree, []);
    if (el) {
      el.style.width = '100%';
      el.style.height = '100%';
      this.container.appendChild(el);
    }
    this._bindEvents();
  }

  _buildNode(node, pathToNode) {
    if (node.Leaf !== undefined) return this._buildLeaf(node.Leaf);
    if (node.Split !== undefined) return this._buildSplit(node.Split, pathToNode);
    return null;
  }

  _buildLeaf(pane) {
    const svcId = (typeof pane.kind === 'object' && pane.kind.Service) ? pane.kind.Service : '';

    const div = document.createElement('div');
    div.className = 'pane';
    div.dataset.paneId = pane.id;
    div.dataset.serviceId = svcId;

    const header = document.createElement('div');
    header.className = 'pane-header';
    header.style.height = PANE_HEADER_HEIGHT + 'px';

    const name = document.createElement('span');
    name.className = 'pane-service-name';
    name.textContent = svcId ? this._getServiceName(svcId) : '—';

    const actions = document.createElement('div');
    actions.className = 'pane-actions';

    for (const [action, label, title] of [
      ['split-h', '⇔', '横分割'],
      ['split-v', '⇕', '縦分割'],
      ['close', '×', '閉じる'],
    ]) {
      const btn = document.createElement('button');
      btn.className = 'pane-btn';
      btn.dataset.action = action;
      btn.title = title;
      btn.textContent = label;
      actions.appendChild(btn);
    }

    header.appendChild(name);
    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'pane-body';

    div.appendChild(header);
    div.appendChild(body);
    return div;
  }

  _buildSplit(split, pathToThisSplit) {
    const isHorizontal = split.direction === 'Horizontal';
    const div = document.createElement('div');
    div.className = `split ${isHorizontal ? 'split-horizontal' : 'split-vertical'}`;
    div.style.display = 'flex';
    div.style.flexDirection = isHorizontal ? 'row' : 'column';
    div.style.width = '100%';
    div.style.height = '100%';

    split.children.forEach((child, i) => {
      const size = split.sizes[i];
      const wrapper = document.createElement('div');
      wrapper.className = 'pane-wrapper';
      wrapper.style.overflow = 'hidden';
      wrapper.style.minWidth = '0';
      wrapper.style.minHeight = '0';

      if (size?.Flex !== undefined) {
        wrapper.style.flex = String(size.Flex);
      } else if (size?.Fixed !== undefined) {
        wrapper.style.flex = `0 0 ${size.Fixed}px`;
      } else {
        wrapper.style.flex = '1';
      }

      const pathToChild = [...pathToThisSplit, i];
      const childEl = this._buildNode(child, pathToChild);
      if (childEl) {
        childEl.style.width = '100%';
        childEl.style.height = '100%';
        wrapper.appendChild(childEl);
      }
      div.appendChild(wrapper);

      if (i < split.children.length - 1) {
        const divider = document.createElement('div');
        divider.className = `split-divider split-divider-${isHorizontal ? 'h' : 'v'}`;
        divider.dataset.path = JSON.stringify(pathToThisSplit);
        divider.dataset.index = String(i);
        div.appendChild(divider);
      }
    });

    return div;
  }

  _getServiceName(serviceId) {
    const svc = this.app?.services?.find(s => s.id === serviceId);
    return svc ? svc.name : serviceId;
  }

  _bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('.pane').forEach(paneEl => {
      paneEl.addEventListener('click', e => {
        if (e.target.closest('.pane-actions, .split-divider')) return;
        const paneId = paneEl.dataset.paneId;
        if (paneId) invoke('focus_pane', { paneId }).catch(console.error);
      });
    });

    this.container.querySelectorAll('.pane-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const paneEl = btn.closest('.pane');
        const paneId = paneEl?.dataset.paneId;
        const action = btn.dataset.action;
        if (!paneId) return;

        try {
          await invoke('focus_pane', { paneId });

          if (action === 'close') {
            this.tree = await invoke('close_pane', { paneId });
            this._render();
          } else if (action === 'split-h' || action === 'split-v') {
            const direction = action === 'split-h' ? 'Horizontal' : 'Vertical';
            const newServiceId = this._pickAvailableService(paneEl.dataset.serviceId);
            if (!newServiceId) {
              console.warn('[PaneTreeManager] no available service for split');
              return;
            }
            this.tree = await invoke('split_pane', { paneId, direction, newServiceId });
            this._render();
          }
        } catch (err) {
          console.error('[PaneTreeManager] action error:', err);
        }
      });
    });

    this.container.querySelectorAll('.split-divider').forEach(divider => {
      divider.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();

        const path = JSON.parse(divider.dataset.path);
        const divIndex = parseInt(divider.dataset.index);
        const isH = divider.classList.contains('split-divider-h');
        const splitNode = this._getSplitNode(this.tree, path);
        if (!splitNode) return;

        const parentEl = divider.parentElement;
        const totalSize = isH ? parentEl.offsetWidth : parentEl.offsetHeight;

        this._dragState = {
          path,
          divIndex,
          isH,
          startPos: isH ? e.clientX : e.clientY,
          startSizes: [...splitNode.sizes],
          totalSize,
          parentEl,
        };

        document.body.classList.add('resizing-active');
        document.body.style.cursor = isH ? 'ew-resize' : 'ns-resize';
        document.body.style.userSelect = 'none';
      });
    });
  }

  _onDragMove(e) {
    if (!this._dragState) return;

    if (this._animFrameId) cancelAnimationFrame(this._animFrameId);

    this._animFrameId = requestAnimationFrame(() => {
      const { path, divIndex, isH, startPos, startSizes, totalSize, parentEl } = this._dragState;
      const delta = (isH ? e.clientX : e.clientY) - startPos;
      const newSizes = this._computeNewSizes(startSizes, divIndex, delta, totalSize);
      if (!newSizes) return;

      // Update DOM flex immediately
      const wrappers = Array.from(parentEl.children).filter(el => el.classList.contains('pane-wrapper'));
      wrappers.forEach((wrapper, i) => {
        const s = newSizes[i];
        if (s?.Flex !== undefined) wrapper.style.flex = String(s.Flex);
        else if (s?.Fixed !== undefined) wrapper.style.flex = `0 0 ${s.Fixed}px`;
      });

      // Update native webview layout
      invoke('resize_split', { path, sizes: newSizes }).catch(console.error);
    });
  }

  _onDragEnd() {
    if (!this._dragState) return;
    this._dragState = null;
    document.body.classList.remove('resizing-active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  _computeNewSizes(startSizes, divIndex, delta, totalSize) {
    const leftSize = startSizes[divIndex];
    const rightSize = startSizes[divIndex + 1];
    if (leftSize?.Flex === undefined || rightSize?.Flex === undefined) return null;

    const totalFlex = leftSize.Flex + rightSize.Flex;
    const leftPxStart = (leftSize.Flex / totalFlex) * totalSize;
    const newLeftPx = Math.max(80, Math.min(totalSize - 80, leftPxStart + delta));
    const newRightPx = totalSize - newLeftPx;

    const newSizes = [...startSizes];
    newSizes[divIndex] = { Flex: (newLeftPx / totalSize) * totalFlex };
    newSizes[divIndex + 1] = { Flex: (newRightPx / totalSize) * totalFlex };
    return newSizes;
  }

  _getSplitNode(node, path) {
    if (path.length === 0) return node.Split ?? null;
    if (!node.Split) return null;
    const [idx, ...rest] = path;
    const child = node.Split.children[idx];
    if (!child) return null;
    return this._getSplitNode(child, rest);
  }

  _pickAvailableService(currentServiceId) {
    const services = this.app?.services ?? [];
    const usedIds = new Set(this._collectServiceIds(this.tree));
    const available = services.filter(s => s.enabled && !usedIds.has(s.id) && s.id !== currentServiceId);
    return available[0]?.id ?? null;
  }

  _collectServiceIds(node) {
    if (!node) return [];
    if (node.Leaf) {
      const id = node.Leaf.kind?.Service;
      return id ? [id] : [];
    }
    if (node.Split) {
      return node.Split.children.flatMap(c => this._collectServiceIds(c));
    }
    return [];
  }
}

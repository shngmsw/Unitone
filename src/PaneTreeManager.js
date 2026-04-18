import { invoke } from '@tauri-apps/api/core';

// Keep in sync with layout.rs PANE_HEADER_HEIGHT
const PANE_HEADER_HEIGHT = 28;

export class PaneTreeManager {
  constructor(app) {
    this.app = app;
    this.container = null;
    this.tree = null;
    this.focusedPaneId = null;
    this._dragState = null;
    this._animFrameId = null;
    this._badgeCounts = {};

    document.addEventListener('mousemove', this._onDragMove.bind(this));
    document.addEventListener('mouseup', this._onDragEnd.bind(this));
    document.addEventListener('click', this._onDocumentClick.bind(this));
  }

  async init() {
    this.container = document.getElementById('webview-container');
    try {
      const result = await invoke('get_service_tree');
      this.tree = result.tree;
      this.focusedPaneId = result.focusedPaneId;
      this._render();
    } catch (e) {
      console.error('[PaneTreeManager] init failed:', e);
    }
  }

  async refresh() {
    try {
      const result = await invoke('get_service_tree');
      this.tree = result.tree;
      this.focusedPaneId = result.focusedPaneId;
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
    this._restoreBadges();
  }

  _buildNode(node, pathToNode) {
    if (node.Leaf !== undefined) return this._buildLeaf(node.Leaf);
    if (node.Split !== undefined) return this._buildSplit(node.Split, pathToNode);
    return null;
  }

  _buildLeaf(pane) {
    const svcId = (typeof pane.kind === 'object' && pane.kind.Service) ? pane.kind.Service : '';
    const isFocused = pane.id === this.focusedPaneId;
    const isEmpty = !svcId;

    const div = document.createElement('div');
    div.className = 'pane' + (isFocused ? ' pane-focused' : '');
    div.dataset.paneId = pane.id;
    div.dataset.serviceId = svcId;

    const header = document.createElement('div');
    header.className = 'pane-header';
    header.style.height = PANE_HEADER_HEIGHT + 'px';

    const dropdownBtn = document.createElement('button');
    dropdownBtn.className = 'pane-service-dropdown';
    dropdownBtn.dataset.paneId = pane.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'pane-dropdown-label';
    nameSpan.textContent = isEmpty ? 'アプリを選択' : this._getServiceName(svcId);

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'pane-dropdown-arrow';
    arrowSpan.textContent = '▾';

    const badge = document.createElement('span');
    badge.className = 'pane-badge hidden';

    dropdownBtn.appendChild(nameSpan);
    dropdownBtn.appendChild(badge);
    dropdownBtn.appendChild(arrowSpan);
    header.appendChild(dropdownBtn);

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

    // Pane click → focus
    this.container.querySelectorAll('.pane').forEach(paneEl => {
      paneEl.addEventListener('click', e => {
        if (e.target.closest('.pane-service-dropdown, .split-divider')) return;
        const paneId = paneEl.dataset.paneId;
        if (paneId) {
          this.focusedPaneId = paneId;
          this._updateFocusVisuals();
          invoke('focus_pane', { paneId }).catch(console.error);
        }
      });
    });

    // Dropdown button click
    this.container.querySelectorAll('.pane-service-dropdown').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const paneId = btn.dataset.paneId;
        const paneEl = btn.closest('.pane');
        const currentSvcId = paneEl?.dataset.serviceId || '';

        if (paneId) {
          this.focusedPaneId = paneId;
          this._updateFocusVisuals();
          invoke('focus_pane', { paneId }).catch(console.error);
        }

        this._openServicePicker(btn, paneId, currentSvcId);
      });
    });

    // Divider drag
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

  _openServicePicker(anchor, paneId, currentSvcId) {
    this._closeServicePicker();

    const services = this.app?.services ?? [];
    const usedIds = new Set(this._collectServiceIds(this.tree));

    const menu = document.createElement('ul');
    menu.className = 'service-picker-menu';
    menu.dataset.forPane = paneId;

    services.filter(s => s.enabled).forEach(svc => {
      const li = document.createElement('li');
      li.className = 'service-picker-item';
      const isCurrent = svc.id === currentSvcId;
      const isAssigned = usedIds.has(svc.id) && !isCurrent;

      if (isCurrent) li.classList.add('current');
      if (isAssigned) li.classList.add('assigned');

      const icon = document.createElement('span');
      icon.className = 'picker-icon';
      icon.textContent = svc.icon || '🔗';

      const name = document.createElement('span');
      name.textContent = svc.name;

      if (isCurrent) {
        const check = document.createElement('span');
        check.className = 'picker-check';
        check.textContent = '✓';
        li.appendChild(icon);
        li.appendChild(name);
        li.appendChild(check);
      } else {
        li.appendChild(icon);
        li.appendChild(name);
      }

      if (!isAssigned) {
        li.addEventListener('click', async e => {
          e.stopPropagation();
          this._closeServicePicker();
          try {
            const result = await invoke('switch_service_in_pane', { paneId, serviceId: svc.id });
            this.tree = result.tree;
            this.focusedPaneId = result.focusedPaneId;
            this._render();
          } catch (err) {
            console.error('[PaneTreeManager] switch_service_in_pane error:', err);
          }
        });
      }

      menu.appendChild(li);
    });

    // Position below anchor
    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.bottom + 'px';
    menu.style.minWidth = rect.width + 'px';

    document.body.appendChild(menu);
  }

  _closeServicePicker() {
    document.querySelectorAll('.service-picker-menu').forEach(el => el.remove());
  }

  _onDocumentClick() {
    this._closeServicePicker();
  }

  _updateFocusVisuals() {
    this.container?.querySelectorAll('.pane').forEach(el => {
      el.classList.toggle('pane-focused', el.dataset.paneId === this.focusedPaneId);
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

  updateBadge(serviceId, count) {
    this._badgeCounts[serviceId] = count;
    const paneEl = this.container?.querySelector(`.pane[data-service-id="${serviceId}"]`);
    if (paneEl) {
      this._applyBadge(paneEl, serviceId);
    }
  }

  _applyBadge(paneEl, serviceId) {
    const count = this._badgeCounts[serviceId] || 0;
    const badge = paneEl.querySelector('.pane-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  _restoreBadges() {
    if (!this.container) return;
    this.container.querySelectorAll('.pane[data-service-id]').forEach(paneEl => {
      const svcId = paneEl.dataset.serviceId;
      if (svcId) this._applyBadge(paneEl, svcId);
    });
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

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const PRESETS = [
  { id: 'single',      label: '▣',  title: '1ペイン' },
  { id: 'two_h',       label: '◫',  title: '2分割（横）' },
  { id: 'two_v',       label: '⬒',  title: '2分割（縦）' },
  { id: 'two_by_two',  label: '⊞',  title: '4分割' },
];

export class PresetPickerManager {
  constructor() {
    this._activePreset = 'single';
    this._container = null;
  }

  init(containerId) {
    this._container = document.getElementById(containerId);
    if (!this._container) return;

    this._render();
    listen('pane-tree-updated', () => this._syncActiveFromTree()).catch(console.error);
    this._syncActiveFromTree();
  }

  _render() {
    this._container.innerHTML = '';
    PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn' + (preset.id === this._activePreset ? ' active' : '');
      btn.dataset.presetId = preset.id;
      btn.title = preset.title;
      btn.textContent = preset.label;
      btn.addEventListener('click', () => this._applyPreset(preset.id));
      this._container.appendChild(btn);
    });
  }

  async _applyPreset(presetId) {
    try {
      await invoke('apply_layout_preset', { preset: presetId });
      this._activePreset = presetId;
      this._updateActiveStyle();
    } catch (e) {
      console.error('[PresetPickerManager] apply_layout_preset error:', e);
    }
  }

  async _syncActiveFromTree() {
    try {
      const result = await invoke('get_service_tree');
      this._activePreset = this._inferPreset(result.tree);
      this._updateActiveStyle();
    } catch (e) { /* ignore */ }
  }

  _inferPreset(tree) {
    if (tree.Leaf !== undefined) return 'single';
    if (tree.Split !== undefined) {
      const { direction, children } = tree.Split;
      if (children.length === 2) {
        const bothSplit = children.every(c => c.Split !== undefined);
        if (bothSplit && direction === 'Horizontal') return 'two_by_two';
        return direction === 'Horizontal' ? 'two_h' : 'two_v';
      }
    }
    return 'single';
  }

  _updateActiveStyle() {
    this._container?.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.presetId === this._activePreset);
    });
  }
}

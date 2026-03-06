// SettingsManager.js - 設定モーダル管理 (Tauri v2)

import { invoke } from '@tauri-apps/api/core';

export class SettingsManager {
  constructor(unitone) {
    this.unitone = unitone;
  }

  // XSS対策: HTMLエスケープ
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  open() {
    const list = document.getElementById('service-settings-list');
    if (!list) return;

    list.innerHTML = '';

    this.unitone.services.forEach(service => {
      const item = document.createElement('div');
      item.className = 'service-setting-item';
      item.innerHTML = `
        <div class="service-info">
          <span class="service-icon">${service.icon}</span>
          <div>
            <div class="service-name">${this.escapeHtml(service.name)}</div>
            <div class="service-url">${this.escapeHtml(service.url)}</div>
          </div>
        </div>
        <div class="service-actions">
          <button class="edit-btn" data-service-id="${this.escapeHtml(service.id)}" title="編集">✏️</button>
          <button class="delete-btn" data-service-id="${this.escapeHtml(service.id)}" title="削除">🗑️</button>
        </div>
      `;
      list.appendChild(item);
    });

    // 編集ボタンのイベント
    list.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const serviceId = btn.dataset.serviceId;
        this.openEditService(serviceId);
      });
    });

    // 削除ボタンのイベント
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const serviceId = btn.dataset.serviceId;
        if (confirm('このサービスを削除しますか？')) {
          this.unitone.services = await invoke('remove_service', { serviceId });
          this.unitone.serviceDockManager.render();

          // WebViewの削除もRust側で処理
          await invoke('remove_service_webview', { serviceId });

          if (this.unitone.activeServiceId === serviceId && this.unitone.services.length > 0) {
            await this.unitone.webViewManager.switchService(this.unitone.services[0].id);
          }

          this.open(); // リストを更新
        }
      });
    });

    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  openEditService(serviceId) {
    const service = this.unitone.services.find(s => s.id === serviceId);
    if (!service) return;

    const idInput = document.getElementById('edit-service-id');
    const nameInput = document.getElementById('edit-service-name');
    const urlInput = document.getElementById('edit-service-url');
    const iconInput = document.getElementById('edit-service-icon');

    if (idInput) idInput.value = service.id;
    if (nameInput) nameInput.value = service.name;
    if (urlInput) urlInput.value = service.url;
    if (iconInput) iconInput.value = service.icon;

    const modal = document.getElementById('edit-service-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  close() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
}

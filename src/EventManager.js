// EventManager.js - イベントリスナー管理 (Tauri v2)

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export class EventManager {
  constructor(hitotone) {
    this.hitotone = hitotone;
  }

  setup() {
    this.setupAiSelectorEvents();
    this.setupServiceEvents();
    this.setupModalEvents();
    this.setupKeyboardShortcuts();
    this.setupTauriListeners();
  }

  setupAiSelectorEvents() {
    const aiSelectorBtn = document.getElementById('ai-selector-btn');
    if (aiSelectorBtn) {
      aiSelectorBtn.addEventListener('click', () => {
        this.hitotone.aiCompanionManager.toggleDropdown();
      });
    }

    const addAiBtn = document.getElementById('add-ai-btn');
    if (addAiBtn) {
      addAiBtn.addEventListener('click', () => {
        this.hitotone.aiCompanionManager.toggleDropdown(false);
        const modal = document.getElementById('add-ai-modal');
        if (modal) modal.classList.remove('hidden');
      });
    }

    const cancelAddAiBtn = document.getElementById('cancel-add-ai-btn');
    if (cancelAddAiBtn) {
      cancelAddAiBtn.addEventListener('click', () => {
        const modal = document.getElementById('add-ai-modal');
        const form = document.getElementById('add-ai-form');
        if (modal) modal.classList.add('hidden');
        if (form) form.reset();
      });
    }

    const addAiForm = document.getElementById('add-ai-form');
    if (addAiForm) {
      addAiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('ai-name');
        const urlInput = document.getElementById('ai-url');
        const name = nameInput ? nameInput.value : '';
        const url = urlInput ? urlInput.value : '';

        this.hitotone.aiServices = await invoke('add_ai_service', {
          service: { id: '', name, url, isDefault: false }
        });
        this.hitotone.aiCompanionManager.renderDropdown();

        const modal = document.getElementById('add-ai-modal');
        if (modal) modal.classList.add('hidden');
        if (addAiForm) addAiForm.reset();
      });
    }

    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', (e) => {
      const selector = document.getElementById('ai-selector');
      const dropdown = document.getElementById('ai-dropdown');
      if (selector && dropdown && !selector.contains(e.target) && !dropdown.classList.contains('hidden')) {
        this.hitotone.aiCompanionManager.toggleDropdown(false);
      }
    });
  }

  setupServiceEvents() {
    const addServiceBtn = document.getElementById('add-service-btn');
    if (addServiceBtn) {
      addServiceBtn.addEventListener('click', () => {
        const modal = document.getElementById('add-service-modal');
        if (modal) modal.classList.remove('hidden');
      });
    }

    const cancelAddBtn = document.getElementById('cancel-add-btn');
    if (cancelAddBtn) {
      cancelAddBtn.addEventListener('click', () => {
        const modal = document.getElementById('add-service-modal');
        const form = document.getElementById('add-service-form');
        if (modal) modal.classList.add('hidden');
        if (form) form.reset();
      });
    }

    const addServiceForm = document.getElementById('add-service-form');
    if (addServiceForm) {
      addServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('service-name');
        const urlInput = document.getElementById('service-url');
        const iconInput = document.getElementById('service-icon');
        const name = nameInput ? nameInput.value : '';
        const url = urlInput ? urlInput.value : '';
        const icon = iconInput ? (iconInput.value || '🔗') : '🔗';

        this.hitotone.services = await invoke('add_service', {
          service: { id: '', name, url, icon, enabled: true }
        });
        this.hitotone.serviceDockManager.render();

        // 新しいサービスのWebViewを作成
        const newService = this.hitotone.services[this.hitotone.services.length - 1];
        if (newService) {
          await invoke('create_service_webview', {
            serviceId: newService.id,
            url: newService.url
          });
        }

        const modal = document.getElementById('add-service-modal');
        if (modal) modal.classList.add('hidden');
        if (addServiceForm) addServiceForm.reset();
      });
    }

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        const modal = document.getElementById('edit-service-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const editServiceForm = document.getElementById('edit-service-form');
    if (editServiceForm) {
      editServiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idInput = document.getElementById('edit-service-id');
        const nameInput = document.getElementById('edit-service-name');
        const urlInput = document.getElementById('edit-service-url');
        const iconInput = document.getElementById('edit-service-icon');

        const id = idInput ? idInput.value : '';
        const name = nameInput ? nameInput.value : '';
        const url = urlInput ? urlInput.value : '';
        const icon = iconInput ? (iconInput.value || '🔗') : '🔗';

        const service = this.hitotone.services.find(s => s.id === id);
        if (service) {
          const updatedService = { ...service, name, url, icon };
          this.hitotone.services = await invoke('update_service', { service: updatedService });
          this.hitotone.serviceDockManager.render();

          // WebViewを再作成（URLが変わった可能性があるため）
          await invoke('remove_service_webview', { serviceId: id });
          await invoke('create_service_webview', { serviceId: id, url });

          if (this.hitotone.activeServiceId === id) {
            await this.hitotone.webViewManager.switchService(id);
          }
        }

        const modal = document.getElementById('edit-service-modal');
        if (modal) modal.classList.add('hidden');
        this.hitotone.settingsManager.open();
      });
    }

    const toggleAiBtn = document.getElementById('toggle-ai-btn');
    if (toggleAiBtn) {
      toggleAiBtn.addEventListener('click', () => {
        this.hitotone.aiCompanionManager.toggle();
      });
    }

    const closeAiBtn = document.getElementById('close-ai-btn');
    if (closeAiBtn) {
      closeAiBtn.addEventListener('click', () => {
        this.hitotone.aiCompanionManager.toggle();
      });
    }

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.hitotone.settingsManager.open();
      });
    }

    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        this.hitotone.settingsManager.close();
      });
    }
  }

  setupModalEvents() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + 数字でサービス切り替え
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const enabledServices = this.hitotone.services.filter(s => s.enabled);
        if (index < enabledServices.length) {
          this.hitotone.webViewManager.switchService(enabledServices[index].id);
        }
      }

      // Escape でモーダルを閉じる
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
          modal.classList.add('hidden');
        });
      }
    });
  }

  setupTauriListeners() {
    // バッジ更新をリッスン
    listen('badge-updated', (event) => {
      const { serviceId, count } = event.payload;
      this.hitotone.serviceDockManager.updateBadge(serviceId, count);
    });

    // AIに送るをリッスン
    listen('send-to-ai', (event) => {
      this.hitotone.aiCompanionManager.sendToAi(event.payload);
    });

    // 認証完了時
    listen('auth-completed', (event) => {
      this.hitotone.webViewManager.navigateActiveWebview(event.payload);
    });

    // favicon更新をリッスン
    listen('favicon-updated', (event) => {
      const { serviceId, faviconUrl } = event.payload;
      this.hitotone.serviceDockManager.updateServiceIcon(serviceId, faviconUrl);
    });
  }
}

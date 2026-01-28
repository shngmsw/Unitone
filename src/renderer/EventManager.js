// EventManager.js - イベントリスナー管理

export class EventManager {
  constructor(unitone) {
    this.unitone = unitone;
  }

  setup() {
    this.setupAiSelectorEvents();
    this.setupServiceEvents();
    this.setupModalEvents();
    this.setupKeyboardShortcuts();
    this.setupIpcListeners();
  }

  setupAiSelectorEvents() {
    const aiSelectorBtn = document.getElementById('ai-selector-btn');
    if (aiSelectorBtn) {
      aiSelectorBtn.addEventListener('click', () => {
        this.unitone.aiCompanionManager.toggleDropdown();
      });
    }

    const addAiBtn = document.getElementById('add-ai-btn');
    if (addAiBtn) {
      addAiBtn.addEventListener('click', () => {
        this.unitone.aiCompanionManager.toggleDropdown(false);
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

        this.unitone.aiServices = await window.unitone.addAiService({ name, url });
        this.unitone.aiCompanionManager.renderDropdown();

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
        this.unitone.aiCompanionManager.toggleDropdown(false);
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

        this.unitone.services = await window.unitone.addService({ name, url, icon });
        this.unitone.serviceDockManager.render();
        this.unitone.webViewManager.createWebViews();

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

        const service = this.unitone.services.find(s => s.id === id);
        if (service) {
          const updatedService = { ...service, name, url, icon };
          this.unitone.services = await window.unitone.updateService(updatedService);
          this.unitone.serviceDockManager.render();
          this.unitone.webViewManager.createWebViews();

          if (this.unitone.activeServiceId === id) {
            this.unitone.webViewManager.switchService(id);
          }
        }

        const modal = document.getElementById('edit-service-modal');
        if (modal) modal.classList.add('hidden');
        this.unitone.settingsManager.open();
      });
    }

    const toggleAiBtn = document.getElementById('toggle-ai-btn');
    if (toggleAiBtn) {
      toggleAiBtn.addEventListener('click', () => {
        this.unitone.aiCompanionManager.toggle();
      });
    }

    const closeAiBtn = document.getElementById('close-ai-btn');
    if (closeAiBtn) {
      closeAiBtn.addEventListener('click', () => {
        this.unitone.aiCompanionManager.toggle();
      });
    }

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.unitone.settingsManager.open();
      });
    }

    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        this.unitone.settingsManager.close();
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
        const enabledServices = this.unitone.services.filter(s => s.enabled);
        if (index < enabledServices.length) {
          this.unitone.webViewManager.switchService(enabledServices[index].id);
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

  setupIpcListeners() {
    // バッジ更新をリッスン
    window.unitone.onBadgeUpdated(({ serviceId, count }) => {
      this.unitone.serviceDockManager.updateBadge(serviceId, count);
    });

    // AIに送るをリッスン
    window.unitone.onSendToAi((text) => {
      this.unitone.aiCompanionManager.sendToAi(text);
    });

    // 認証完了時にアクティブなwebviewを認証後のURLにナビゲート
    window.unitone.onAuthCompleted((url) => {
      this.unitone.webViewManager.navigateActiveWebview(url);
    });
  }
}

// Unitone Renderer Process

class Unitone {
  constructor() {
    this.services = [];
    this.activeServiceId = null;
    this.webviews = new Map();
    this.badges = new Map();

    this.init();
  }

  async init() {
    // プラットフォーム判定してbodyにクラスを追加
    const platform = await window.unitone.getPlatform();
    document.body.classList.add(`platform-${platform}`);

    // 設定を読み込み
    this.services = await window.unitone.getServices();
    this.activeServiceId = await window.unitone.getActiveService();
    const showAiCompanion = await window.unitone.getShowAiCompanion();

    // サービスドックを構築
    this.renderServiceDock();

    // WebViewを作成
    this.createWebViews();

    // AIコンパニオンを設定
    await this.setupAiCompanion(showAiCompanion);

    // イベントリスナーを設定
    this.setupEventListeners();

    // バッジ更新をリッスン
    window.unitone.onBadgeUpdated(({ serviceId, count }) => {
      this.updateBadge(serviceId, count);
    });

    // 初期サービスをアクティブに
    if (this.activeServiceId) {
      this.switchService(this.activeServiceId);
    } else if (this.services.length > 0) {
      this.switchService(this.services[0].id);
    }
  }

  renderServiceDock() {
    const serviceList = document.getElementById('service-list');
    serviceList.innerHTML = '';

    this.services.filter(s => s.enabled).forEach(service => {
      const item = document.createElement('div');
      item.className = 'service-item';
      item.dataset.serviceId = service.id;
      item.title = service.name;
      item.innerHTML = `
        ${service.icon}
        <span class="badge hidden">0</span>
      `;

      item.addEventListener('click', () => this.switchService(service.id));
      serviceList.appendChild(item);
    });
  }

  createWebViews() {
    const container = document.getElementById('webview-container');
    container.innerHTML = '';

    this.services.filter(s => s.enabled).forEach(service => {
      const webview = document.createElement('webview');
      webview.id = `webview-${service.id}`;
      webview.src = service.url;
      webview.partition = `persist:${service.id}`;
      webview.setAttribute('allowpopups', 'true');
      webview.setAttribute('preload', '../preload/webview-preload.js');

      // 読み込み完了時
      webview.addEventListener('did-finish-load', () => {
        this.hideLoading();
        // サービスIDをwebviewに送信
        webview.contentWindow.postMessage({
          type: 'set-service-id',
          serviceId: service.id
        }, '*');
      });

      // 読み込み開始時
      webview.addEventListener('did-start-loading', () => {
        if (this.activeServiceId === service.id) {
          this.showLoading();
        }
      });

      // 通知メッセージを受け取る
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'notification-count') {
          this.updateBadge(service.id, event.args[0]);
        }
      });

      container.appendChild(webview);
      this.webviews.set(service.id, webview);
    });

    // webviewからのメッセージを受け取る
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'notification-count') {
        this.updateBadge(event.data.serviceId, event.data.count);
        window.unitone.updateBadge(event.data.serviceId, event.data.count);
      }
    });
  }

  switchService(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;

    // 前のアクティブを非アクティブに
    document.querySelectorAll('.service-item').forEach(item => {
      item.classList.remove('active');
    });

    // webviewの表示を切り替え
    this.webviews.forEach((webview, id) => {
      webview.classList.toggle('active', id === serviceId);
    });

    // アクティブなサービスを更新
    this.activeServiceId = serviceId;
    const activeItem = document.querySelector(`.service-item[data-service-id="${serviceId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // 設定を保存
    window.unitone.setActiveService(serviceId);
  }

  async setupAiCompanion(show) {
    const aiCompanion = document.getElementById('ai-companion');
    const aiWebview = document.getElementById('ai-webview');
    const geminiUrl = await window.unitone.getGeminiUrl();

    if (show) {
      aiCompanion.classList.remove('hidden');
      if (aiWebview.src === 'about:blank') {
        aiWebview.src = geminiUrl;
      }
    } else {
      aiCompanion.classList.add('hidden');
    }
  }

  toggleAiCompanion() {
    const aiCompanion = document.getElementById('ai-companion');
    const isHidden = aiCompanion.classList.toggle('hidden');
    window.unitone.setShowAiCompanion(!isHidden);

    if (!isHidden) {
      const aiWebview = document.getElementById('ai-webview');
      if (aiWebview.src === 'about:blank') {
        window.unitone.getGeminiUrl().then(url => {
          aiWebview.src = url;
        });
      }
    }
  }

  updateBadge(serviceId, count) {
    this.badges.set(serviceId, count);
    const item = document.querySelector(`.service-item[data-service-id="${serviceId}"]`);
    if (item) {
      const badge = item.querySelector('.badge');
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  showLoading() {
    document.getElementById('loading-indicator').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading-indicator').classList.add('hidden');
  }

  setupEventListeners() {
    // サービス追加ボタン
    document.getElementById('add-service-btn').addEventListener('click', () => {
      document.getElementById('add-service-modal').classList.remove('hidden');
    });

    // サービス追加キャンセル
    document.getElementById('cancel-add-btn').addEventListener('click', () => {
      document.getElementById('add-service-modal').classList.add('hidden');
      document.getElementById('add-service-form').reset();
    });

    // サービス追加フォーム送信
    document.getElementById('add-service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('service-name').value;
      const url = document.getElementById('service-url').value;
      const icon = document.getElementById('service-icon').value || '🔗';

      this.services = await window.unitone.addService({ name, url, icon });
      this.renderServiceDock();
      this.createWebViews();

      document.getElementById('add-service-modal').classList.add('hidden');
      document.getElementById('add-service-form').reset();
    });

    // AIコンパニオン切り替え
    document.getElementById('toggle-ai-btn').addEventListener('click', () => {
      this.toggleAiCompanion();
    });

    // AIコンパニオン閉じる
    document.getElementById('close-ai-btn').addEventListener('click', () => {
      this.toggleAiCompanion();
    });

    // 設定ボタン
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openSettings();
    });

    // 設定閉じる
    document.getElementById('close-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    // モーダル外クリックで閉じる
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + 数字でサービス切り替え
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const enabledServices = this.services.filter(s => s.enabled);
        if (index < enabledServices.length) {
          this.switchService(enabledServices[index].id);
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

  openSettings() {
    const list = document.getElementById('service-settings-list');
    list.innerHTML = '';

    this.services.forEach(service => {
      const item = document.createElement('div');
      item.className = 'service-setting-item';
      item.innerHTML = `
        <div class="service-info">
          <span class="service-icon">${service.icon}</span>
          <div>
            <div class="service-name">${service.name}</div>
            <div class="service-url">${service.url}</div>
          </div>
        </div>
        <button class="delete-btn" data-service-id="${service.id}" title="削除">🗑</button>
      `;
      list.appendChild(item);
    });

    // 削除ボタンのイベント
    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const serviceId = btn.dataset.serviceId;
        if (confirm('このサービスを削除しますか？')) {
          this.services = await window.unitone.removeService(serviceId);
          this.renderServiceDock();
          this.createWebViews();

          // 削除されたサービスがアクティブだった場合
          if (this.activeServiceId === serviceId && this.services.length > 0) {
            this.switchService(this.services[0].id);
          }

          this.openSettings(); // リストを更新
        }
      });
    });

    document.getElementById('settings-modal').classList.remove('hidden');
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new Unitone();
});

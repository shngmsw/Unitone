// Unitone Renderer Process

class Unitone {
  constructor() {
    this.services = [];
    this.activeServiceId = null;
    this.webviews = new Map();
    this.badges = new Map();
    this.loadingTimer = null;
    this.initialLoadDone = new Set();
<<<<<<< HEAD
    this.faviconExtracted = new Set(); // Track services with extracted favicons
=======
    this.draggedElement = null;
>>>>>>> origin/copilot/add-sort-functionality-services

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
    const aiWidth = await window.unitone.getAiWidth();

    // サービスドックを構築
    this.renderServiceDock();

    // WebViewを作成
    this.createWebViews();

    // AIコンパニオンを設定
    await this.setupAiCompanion(showAiCompanion, aiWidth);

    // イベントリスナーを設定
    this.setupEventListeners();

    // リサイズハンドルを設定
    this.setupResizeHandle();

    // バッジ更新をリッスン
    window.unitone.onBadgeUpdated(({ serviceId, count }) => {
      this.updateBadge(serviceId, count);
    });

    // Geminiに送るをリッスン
    window.unitone.onSendToGemini((text) => {
      this.sendToGemini(text);
    });

    // 認証完了時にアクティブなwebviewを認証後のURLにナビゲート
    window.unitone.onAuthCompleted((url) => {
      this.navigateActiveWebview(url);
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
      item.draggable = true;

      // Use favicon if available, otherwise use emoji
      if (service.faviconUrl) {
        const img = document.createElement('img');
        img.className = 'service-favicon';
        img.src = service.faviconUrl;
        img.alt = service.name;
        item.appendChild(img);
      } else {
        item.textContent = service.icon;
      }

      const badge = document.createElement('span');
      badge.className = 'badge hidden';
      badge.textContent = '0';
      item.appendChild(badge);

      item.addEventListener('click', () => this.switchService(service.id));

      // Drag and drop event listeners
      item.addEventListener('dragstart', (e) => this.handleDragStart(e));
      item.addEventListener('dragover', (e) => this.handleDragOver(e));
      item.addEventListener('drop', (e) => this.handleDrop(e));
      item.addEventListener('dragend', (e) => this.handleDragEnd(e));
      item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      item.addEventListener('dragleave', (e) => this.handleDragLeave(e));

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

      // DOM準備完了時
      webview.addEventListener('dom-ready', () => {
        // サービスIDをwebviewに送信
        webview.executeJavaScript(`
          window.postMessage({ type: 'set-service-id', serviceId: '${service.id}' }, '*');
        `);
        
        this.initialLoadDone.add(service.id);
        if (this.activeServiceId === service.id) {
          this.hideLoading();
        }
        
        // Extract favicon from the loaded page (only once per service)
        if (!this.faviconExtracted.has(service.id)) {
          this.extractFavicon(webview, service.id);
        }
      });

      // 読み込み完了時
      webview.addEventListener('did-finish-load', () => {
        this.initialLoadDone.add(service.id);
        if (this.activeServiceId === service.id) {
          this.hideLoading();
        }
      });

      // 読み込み失敗時
      webview.addEventListener('did-fail-load', (event) => {
        if (this.activeServiceId === service.id) {
          this.hideLoading();
        }
        console.warn(`Failed to load ${service.name}:`, event.errorDescription);
      });

      // 読み込み開始時（初回のみ、遅延表示）
      webview.addEventListener('did-start-loading', () => {
        if (this.activeServiceId === service.id && !this.initialLoadDone.has(service.id)) {
          this.showLoadingDelayed();
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

    // webviewの表示を切り替え（CPU最適化: 非アクティブなWebViewをスロットル）
    this.webviews.forEach((webview, id) => {
      const isActive = id === serviceId;
      webview.classList.toggle('active', isActive);

      // 非アクティブなWebViewのバックグラウンド処理を抑制
      if (isActive) {
        // アクティブ: オーディオ有効、表示
        webview.setAudioMuted(false);
        webview.style.visibility = 'visible';
      } else {
        // 非アクティブ: オーディオミュート、非表示（レンダリング停止）
        webview.setAudioMuted(true);
        webview.style.visibility = 'hidden';
      }
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

  async setupAiCompanion(show, width) {
    const aiCompanion = document.getElementById('ai-companion');
    const aiWebview = document.getElementById('ai-webview');
    const geminiUrl = await window.unitone.getGeminiUrl();

    // 幅を設定（300-800pxの範囲でバリデーション）
    if (width) {
      const minWidth = 300;
      const maxWidth = 800;
      const validWidth = Math.max(minWidth, Math.min(maxWidth, width));
      aiCompanion.style.width = `${validWidth}px`;
    }

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

  reloadActiveWebview() {
    const webview = this.webviews.get(this.activeServiceId);
    if (webview) {
      webview.reload();
    }
  }

  navigateActiveWebview(url) {
    const webview = this.webviews.get(this.activeServiceId);
    if (webview && url) {
      webview.src = url;
    } else if (webview) {
      webview.reload();
    }
  }

  sendToGemini(text) {
    // AIコンパニオンを表示
    const aiCompanion = document.getElementById('ai-companion');
    if (aiCompanion.classList.contains('hidden')) {
      this.toggleAiCompanion();
    }

    const aiWebview = document.getElementById('ai-webview');

    // Geminiが読み込まれるのを待ってからテキストを入力
    const tryInsertText = () => {
      // Geminiの入力欄にテキストを挿入するスクリプト
      aiWebview.executeJavaScript(`
        (function() {
          // Geminiの入力欄を探す
          const textareas = document.querySelectorAll('textarea, [contenteditable="true"], .ql-editor, [role="textbox"]');
          for (const el of textareas) {
            if (el.offsetParent !== null) { // 可視要素のみ
              if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                el.value = ${JSON.stringify(text)};
                el.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                el.textContent = ${JSON.stringify(text)};
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              el.focus();
              return true;
            }
          }
          return false;
        })();
      `).then(result => {
        if (!result) {
          console.log('Geminiの入力欄が見つかりませんでした。クリップボードにコピーしました。');
          // フォールバック：クリップボードにコピー
          navigator.clipboard.writeText(text);
        }
      }).catch(err => {
        console.error('Geminiへの送信に失敗:', err);
        navigator.clipboard.writeText(text);
      });
    };

    // webviewが読み込み済みならすぐ実行、そうでなければ待つ
    if (aiWebview.src !== 'about:blank') {
      tryInsertText();
    } else {
      aiWebview.addEventListener('dom-ready', tryInsertText, { once: true });
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

  showLoadingDelayed() {
    // 既存のタイマーをクリア
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }
    // 500ms後にまだ読み込み中ならローディング表示
    this.loadingTimer = setTimeout(() => {
      this.showLoading();
    }, 500);
  }

  hideLoading() {
    // タイマーをクリア
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    document.getElementById('loading-indicator').classList.add('hidden');
  }

  async extractFavicon(webview, serviceId) {
    try {
      // Execute script in webview to get favicon URL
      const faviconUrl = await webview.executeJavaScript(`
        (function() {
          // Try different selectors for favicon
          const selectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]'
          ];
          
          for (const selector of selectors) {
            const link = document.querySelector(selector);
            if (link && link.href) {
              return link.href;
            }
          }
          
          // Return null if no favicon found (don't fallback to /favicon.ico)
          return null;
        })();
      `);

      if (faviconUrl && this.isValidFaviconUrl(faviconUrl)) {
        // Mark as extracted to prevent repeated attempts
        this.faviconExtracted.add(serviceId);
        
        // Update service with favicon URL
        const service = this.services.find(s => s.id === serviceId);
        if (service && service.faviconUrl !== faviconUrl) {
          service.faviconUrl = faviconUrl;
          await window.unitone.updateService(service);
          
          // Update only this service's icon instead of re-rendering entire dock
          this.updateServiceIcon(serviceId, faviconUrl);
        }
      }
    } catch (error) {
      console.warn(`Failed to extract favicon for ${serviceId}:`, error);
      // Mark as extracted to prevent retrying on every dom-ready
      this.faviconExtracted.add(serviceId);
    }
  }

  isValidFaviconUrl(url) {
    try {
      const parsedUrl = new URL(url);
      // Only allow http, https, and data URLs (not javascript:)
      return ['http:', 'https:', 'data:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  updateServiceIcon(serviceId, faviconUrl) {
    const item = document.querySelector(`.service-item[data-service-id="${serviceId}"]`);
    if (item) {
      // Remove old icon (emoji or old favicon)
      const oldIcon = item.querySelector('.service-favicon') || item.firstChild;
      if (oldIcon && oldIcon.nodeType === Node.TEXT_NODE) {
        oldIcon.remove();
      } else if (oldIcon && oldIcon.classList && oldIcon.classList.contains('service-favicon')) {
        oldIcon.remove();
      }
      
      // Add new favicon
      const img = document.createElement('img');
      img.className = 'service-favicon';
      img.src = faviconUrl;
      const service = this.services.find(s => s.id === serviceId);
      img.alt = service ? service.name : '';
      
      // Insert before badge
      const badge = item.querySelector('.badge');
      item.insertBefore(img, badge);
    }
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

    // サービス編集キャンセル
    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
      document.getElementById('edit-service-modal').classList.add('hidden');
    });

    // サービス編集フォーム送信
    document.getElementById('edit-service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-service-id').value;
      const name = document.getElementById('edit-service-name').value;
      const url = document.getElementById('edit-service-url').value;
      const icon = document.getElementById('edit-service-icon').value || '🔗';

      const service = this.services.find(s => s.id === id);
      if (service) {
        const updatedService = { ...service, name, url, icon };
        this.services = await window.unitone.updateService(updatedService);
        this.renderServiceDock();
        this.createWebViews();

        // 編集したサービスがアクティブなら再読み込み
        if (this.activeServiceId === id) {
          this.switchService(id);
        }
      }

      document.getElementById('edit-service-modal').classList.add('hidden');
      this.openSettings(); // 設定リストを更新
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
        <div class="service-actions">
          <button class="edit-btn" data-service-id="${service.id}" title="編集">✏️</button>
          <button class="delete-btn" data-service-id="${service.id}" title="削除">🗑️</button>
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

  openEditService(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;

    document.getElementById('edit-service-id').value = service.id;
    document.getElementById('edit-service-name').value = service.name;
    document.getElementById('edit-service-url').value = service.url;
    document.getElementById('edit-service-icon').value = service.icon;

    document.getElementById('edit-service-modal').classList.remove('hidden');
  }

<<<<<<< HEAD
  setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const aiCompanion = document.getElementById('ai-companion');
    
    // 要素が存在しない場合は早期リターン
    if (!resizeHandle || !aiCompanion) {
      return;
    }
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let animationFrameId = null;

    // CSS変数から最小・最大幅を取得
    const computedStyle = getComputedStyle(document.documentElement);
    const minWidth = parseInt(computedStyle.getPropertyValue('--ai-min-width')) || 300;
    const maxWidth = parseInt(computedStyle.getPropertyValue('--ai-max-width')) || 800;

    const onMouseMove = (e) => {
      if (!isResizing || aiCompanion.classList.contains('hidden')) return;

      // requestAnimationFrameでパフォーマンス最適化
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        // 右から左へのドラッグなので、差分を反転
        const deltaX = startX - e.clientX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
        
        aiCompanion.style.width = `${newWidth}px`;
      });
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        aiCompanion.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // 現在の幅を保存
        const currentWidth = aiCompanion.offsetWidth;
        window.unitone.setAiWidth(currentWidth).catch(err => {
          console.warn('AI幅の保存に失敗しました:', err);
        });
      }
    };

    resizeHandle.addEventListener('mousedown', (e) => {
      // 非表示の場合はリサイズを許可しない
      if (aiCompanion.classList.contains('hidden')) {
        return;
      }
      
      isResizing = true;
      startX = e.clientX;
      startWidth = aiCompanion.offsetWidth;
      aiCompanion.classList.add('resizing');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // キーボードアクセシビリティ: 矢印キーでリサイズ
    resizeHandle.addEventListener('keydown', (e) => {
      if (aiCompanion.classList.contains('hidden')) return;

      const step = 10; // 1回のキー押下で10px変更
      let currentWidth = aiCompanion.offsetWidth;
      let newWidth = currentWidth;

      if (e.key === 'ArrowLeft') {
        // 左矢印: 幅を広げる
        newWidth = Math.min(maxWidth, currentWidth + step);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        // 右矢印: 幅を狭める
        newWidth = Math.max(minWidth, currentWidth - step);
        e.preventDefault();
      }

      if (newWidth !== currentWidth) {
        aiCompanion.style.width = `${newWidth}px`;
        // 幅を保存
        window.unitone.setAiWidth(newWidth).catch(err => {
          console.warn('AI幅の保存に失敗しました:', err);
        });
      }
    });
=======
  // Drag and drop handlers
  handleDragStart(e) {
    this.draggedElement = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.serviceId);
  }

  handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleDragEnter(e) {
    if (e.currentTarget !== this.draggedElement) {
      e.currentTarget.classList.add('drag-over');
    }
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  async handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    const dropTarget = e.currentTarget;
    dropTarget.classList.remove('drag-over');

    if (this.draggedElement !== dropTarget) {
      // Get the service IDs
      const draggedId = this.draggedElement.dataset.serviceId;
      const targetId = dropTarget.dataset.serviceId;

      // Find indices in the services array
      const draggedIndex = this.services.findIndex(s => s.id === draggedId);
      const targetIndex = this.services.findIndex(s => s.id === targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Reorder the services array
        const [draggedService] = this.services.splice(draggedIndex, 1);
        this.services.splice(targetIndex, 0, draggedService);

        // Save the new order and wait for it to complete
        await window.unitone.reorderServices(this.services);

        // Re-render the service dock
        this.renderServiceDock();
      }
    }

    return false;
  }

  handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    
    // Remove drag-over class from all items
    document.querySelectorAll('.service-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    
    this.draggedElement = null;
>>>>>>> origin/copilot/add-sort-functionality-services
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new Unitone();
});

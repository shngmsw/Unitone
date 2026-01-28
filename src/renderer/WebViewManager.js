// WebViewManager.js - WebView作成・管理

export class WebViewManager {
  constructor(unitone) {
    this.unitone = unitone;
    this.webviews = new Map();
    this.initialLoadDone = new Set();
    this.faviconExtracted = new Set();
  }

  createWebViews() {
    const container = document.getElementById('webview-container');
    if (!container) return;

    container.innerHTML = '';

    this.unitone.services.filter(s => s.enabled).forEach(service => {
      const webview = document.createElement('webview');
      webview.id = `webview-${service.id}`;
      webview.src = service.url;
      webview.partition = `persist:${service.id}`;
      webview.setAttribute('allowpopups', 'true');

      // DOM準備完了時
      webview.addEventListener('dom-ready', () => {
        const serviceIdJson = JSON.stringify(service.id);
        webview.executeJavaScript(`
          window.postMessage({ type: 'set-service-id', serviceId: ${serviceIdJson} }, '*');
        `);

        this.initialLoadDone.add(service.id);
        if (this.unitone.activeServiceId === service.id) {
          this.unitone.loadingManager.hide();
        }
      });

      // 読み込み完了時
      webview.addEventListener('did-finish-load', () => {
        this.initialLoadDone.add(service.id);
        if (this.unitone.activeServiceId === service.id) {
          this.unitone.loadingManager.hide();
        }

        // Extract favicon (only once per service)
        if (!this.faviconExtracted.has(service.id)) {
          setTimeout(() => {
            this.extractFavicon(webview, service.id);
          }, 1500);
        }
      });

      // 読み込み失敗時
      webview.addEventListener('did-fail-load', (event) => {
        if (this.unitone.activeServiceId === service.id) {
          this.unitone.loadingManager.hide();
        }
        console.warn(`Failed to load ${service.name}:`, event.errorDescription);
      });

      // 読み込み開始時（初回のみ、遅延表示）
      webview.addEventListener('did-start-loading', () => {
        if (this.unitone.activeServiceId === service.id && !this.initialLoadDone.has(service.id)) {
          this.unitone.loadingManager.showDelayed();
        }
      });

      // 通知メッセージを受け取る
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'notification-count') {
          this.unitone.serviceDockManager.updateBadge(service.id, event.args[0]);
        }
      });

      container.appendChild(webview);
      this.webviews.set(service.id, webview);
    });
  }

  switchService(serviceId) {
    const service = this.unitone.services.find(s => s.id === serviceId);
    if (!service) return;

    // 前のアクティブを非アクティブに
    document.querySelectorAll('.service-item').forEach(item => {
      item.classList.remove('active');
    });

    // webviewの表示を切り替え（CPU最適化: 非アクティブなWebViewをスロットル）
    this.webviews.forEach((webview, id) => {
      const isActive = id === serviceId;
      webview.classList.toggle('active', isActive);

      if (isActive) {
        webview.setAudioMuted(false);
        webview.style.visibility = 'visible';
      } else {
        webview.setAudioMuted(true);
        webview.style.visibility = 'hidden';
      }
    });

    // アクティブなサービスを更新
    this.unitone.activeServiceId = serviceId;
    const activeItem = document.querySelector(`.service-item[data-service-id="${serviceId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // 設定を保存
    window.unitone.setActiveService(serviceId);
  }

  reloadActiveWebview() {
    const webview = this.webviews.get(this.unitone.activeServiceId);
    if (webview) {
      webview.reload();
    }
  }

  navigateActiveWebview(url) {
    const webview = this.webviews.get(this.unitone.activeServiceId);
    if (webview && url) {
      webview.src = url;

      // Slackの場合、認証後のURLを保存する
      if (this.unitone.activeServiceId === 'slack' && url.includes('app.slack.com/client/')) {
        window.unitone.updateServiceUrl('slack', url).then(() => {
          window.unitone.getServices().then(services => {
            this.unitone.services = services;
          });
        });
      }
    } else if (webview) {
      webview.reload();
    }
  }

  async extractFavicon(webview, serviceId) {
    try {
      const faviconUrl = await webview.executeJavaScript(`
        (function() {
          const selectors = [
            'link[rel="icon"]',
            'link[rel*="icon"]',
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

          return new URL('/favicon.ico', window.location.origin).href;
        })();
      `);

      if (faviconUrl && this.isValidFaviconUrl(faviconUrl)) {
        this.faviconExtracted.add(serviceId);

        const service = this.unitone.services.find(s => s.id === serviceId);
        if (service && service.faviconUrl !== faviconUrl) {
          service.faviconUrl = faviconUrl;
          await window.unitone.updateService(service);
          this.unitone.serviceDockManager.updateServiceIcon(serviceId, faviconUrl);
        }
      } else {
        this.faviconExtracted.add(serviceId);
      }
    } catch (error) {
      console.warn(`Failed to extract favicon for ${serviceId}:`, error);
      this.faviconExtracted.add(serviceId);
    }
  }

  isValidFaviconUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:', 'data:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  getWebview(serviceId) {
    return this.webviews.get(serviceId);
  }
}

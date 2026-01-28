// Unitone Renderer Process - Main Entry Point

import { LoadingManager } from './LoadingManager.js';
import { ServiceDockManager } from './ServiceDockManager.js';
import { WebViewManager } from './WebViewManager.js';
import { AiCompanionManager } from './AiCompanionManager.js';
import { SettingsManager } from './SettingsManager.js';
import { EventManager } from './EventManager.js';
import { UpdateManager } from './UpdateManager.js';

class Unitone {
  constructor() {
    // State
    this.services = [];
    this.activeServiceId = null;
    this.aiServices = [];
    this.activeAiService = null;

    // Managers
    this.loadingManager = new LoadingManager();
    this.serviceDockManager = new ServiceDockManager(this);
    this.webViewManager = new WebViewManager(this);
    this.aiCompanionManager = new AiCompanionManager(this);
    this.settingsManager = new SettingsManager(this);
    this.eventManager = new EventManager(this);
    this.updateManager = new UpdateManager();

    this.init();
  }

  async init() {
    try {
      // プラットフォーム判定してbodyにクラスを追加
      const platform = await window.unitone.getPlatform();
      document.body.classList.add(`platform-${platform}`);

      // 設定を読み込み
      this.services = await window.unitone.getServices();
      this.activeServiceId = await window.unitone.getActiveService();
      this.aiServices = await window.unitone.getAiServices();
      this.activeAiService = await window.unitone.getActiveAiService();
      const showAiCompanion = await window.unitone.getShowAiCompanion();
      const aiWidth = await window.unitone.getAiWidth();

      // サービスドックを構築
      this.serviceDockManager.render();

      // WebViewを作成
      this.webViewManager.createWebViews();

      // AIコンパニオンを設定
      await this.aiCompanionManager.setup(showAiCompanion, aiWidth);

      // イベントリスナーを設定
      this.eventManager.setup();

      // リサイズハンドルを設定
      this.aiCompanionManager.setupResizeHandle();

      // 初期サービスをアクティブに
      if (this.activeServiceId) {
        this.webViewManager.switchService(this.activeServiceId);
      } else if (this.services.length > 0) {
        this.webViewManager.switchService(this.services[0].id);
      }
    } catch (error) {
      console.error('Unitone initialization failed:', error);
    }
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new Unitone();
});

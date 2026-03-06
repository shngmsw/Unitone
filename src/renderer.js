// Unitone Renderer Process - Main Entry Point (Tauri v2)

import { invoke } from '@tauri-apps/api/core';
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
      console.log('[Unitone] init() start');

      // プラットフォーム判定してbodyにクラスを追加
      const platform = await invoke('get_platform');
      document.body.classList.add(`platform-${platform}`);
      console.log('[Unitone] platform:', platform);

      // 設定を読み込み
      this.services = await invoke('get_services');
      console.log('[Unitone] services:', this.services);
      this.activeServiceId = await invoke('get_active_service');
      console.log('[Unitone] activeServiceId:', this.activeServiceId);
      this.aiServices = await invoke('get_ai_services');
      console.log('[Unitone] aiServices:', this.aiServices);
      this.activeAiService = await invoke('get_active_ai_service');
      console.log('[Unitone] activeAiService:', this.activeAiService);
      const showAiCompanion = await invoke('get_show_ai_companion');
      const aiWidth = await invoke('get_ai_width');
      console.log('[Unitone] showAiCompanion:', showAiCompanion, 'aiWidth:', aiWidth);

      // サービスドックを構築
      this.serviceDockManager.render();
      console.log('[Unitone] dock rendered');

      // イベントリスナーを設定（先に登録してボタンを確実に動くようにする）
      this.eventManager.setup();
      console.log('[Unitone] event listeners setup done');

      // リサイズハンドルを設定
      this.aiCompanionManager.setupResizeHandle();

      // WebViewをRust側で作成
      try {
        console.log('[Unitone] creating webviews...');
        await this.webViewManager.createWebViews();
        console.log('[Unitone] webviews created');
      } catch (err) {
        console.warn('[Unitone] webview creation error (non-fatal):', err);
      }

      // AIコンパニオンを設定
      try {
        console.log('[Unitone] setting up AI companion...');
        await this.aiCompanionManager.setup(showAiCompanion, aiWidth);
        console.log('[Unitone] AI companion setup done');
      } catch (err) {
        console.warn('[Unitone] AI companion setup error (non-fatal):', err);
      }

      // 初期サービスをアクティブに
      if (this.activeServiceId) {
        console.log('[Unitone] switching to active service:', this.activeServiceId);
        await this.webViewManager.switchService(this.activeServiceId);
      } else if (this.services.length > 0) {
        console.log('[Unitone] switching to first service:', this.services[0].id);
        await this.webViewManager.switchService(this.services[0].id);
      }

      // ローディング非表示
      this.loadingManager.hide();
      console.log('[Unitone] init() complete - loading hidden');
    } catch (error) {
      console.error('Unitone initialization failed:', error);
      console.error('Error stack:', error.stack || error);
    }
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new Unitone();
});

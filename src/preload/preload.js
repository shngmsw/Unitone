const { contextBridge, ipcRenderer } = require('electron');

// 許可されたIPCチャンネル（ホワイトリスト方式）
const ALLOWED_INVOKE_CHANNELS = [
  'get-services', 'add-service', 'remove-service', 'update-service',
  'reorder-services', 'update-service-url', 'get-active-service', 'set-active-service',
  'get-show-ai-companion', 'set-show-ai-companion', 'get-ai-width', 'set-ai-width',
  'get-ai-services', 'get-active-ai-service', 'set-active-ai-service',
  'add-ai-service', 'remove-ai-service', 'window-is-maximized', 'get-platform',
  'check-for-updates', 'download-update', 'install-update', 'get-current-version'
];

const ALLOWED_SEND_CHANNELS = [
  'update-badge', 'window-minimize', 'window-maximize', 'window-close'
];

const ALLOWED_RECEIVE_CHANNELS = [
  'badge-updated', 'send-to-ai', 'auth-completed', 'update-status'
];

// 安全なinvokeラッパー
const safeInvoke = (channel, ...args) => {
  if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
    return ipcRenderer.invoke(channel, ...args);
  }
  return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
};

// 安全なsendラッパー
const safeSend = (channel, ...args) => {
  if (ALLOWED_SEND_CHANNELS.includes(channel)) {
    ipcRenderer.send(channel, ...args);
  }
};

// イベントリスナー管理（クリーンアップ対応）
const listenerMap = new Map();

const safeOn = (channel, callback) => {
  if (!ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
    return () => {};
  }

  const wrappedCallback = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrappedCallback);

  // クリーンアップ用にマッピング保存
  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, []);
  }
  listenerMap.get(channel).push({ original: callback, wrapped: wrappedCallback });

  // クリーンアップ関数を返す
  return () => {
    ipcRenderer.removeListener(channel, wrappedCallback);
    const listeners = listenerMap.get(channel);
    if (listeners) {
      const index = listeners.findIndex(l => l.original === callback);
      if (index !== -1) listeners.splice(index, 1);
    }
  };
};

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('unitone', {
  // サービス管理
  getServices: () => safeInvoke('get-services'),
  addService: (service) => safeInvoke('add-service', service),
  removeService: (serviceId) => safeInvoke('remove-service', serviceId),
  updateService: (service) => safeInvoke('update-service', service),
  reorderServices: (services) => safeInvoke('reorder-services', services),
  updateServiceUrl: (serviceId, url) => safeInvoke('update-service-url', serviceId, url),

  // アクティブサービス
  getActiveService: () => safeInvoke('get-active-service'),
  setActiveService: (serviceId) => safeInvoke('set-active-service', serviceId),

  // AIコンパニオン
  getShowAiCompanion: () => safeInvoke('get-show-ai-companion'),
  setShowAiCompanion: (show) => safeInvoke('set-show-ai-companion', show),
  getAiWidth: () => safeInvoke('get-ai-width'),
  setAiWidth: (width) => safeInvoke('set-ai-width', width),

  // AIサービス管理
  getAiServices: () => safeInvoke('get-ai-services'),
  getActiveAiService: () => safeInvoke('get-active-ai-service'),
  setActiveAiService: (serviceId) => safeInvoke('set-active-ai-service', serviceId),
  addAiService: (service) => safeInvoke('add-ai-service', service),
  removeAiService: (serviceId) => safeInvoke('remove-ai-service', serviceId),

  // 通知バッジ
  updateBadge: (serviceId, count) => safeSend('update-badge', { serviceId, count }),
  onBadgeUpdated: (callback) => safeOn('badge-updated', callback),

  // AIに送る
  onSendToAi: (callback) => safeOn('send-to-ai', callback),

  // 認証完了
  onAuthCompleted: (callback) => safeOn('auth-completed', callback),

  // ウィンドウ操作（Windows用カスタムタイトルバー）
  windowMinimize: () => safeSend('window-minimize'),
  windowMaximize: () => safeSend('window-maximize'),
  windowClose: () => safeSend('window-close'),
  windowIsMaximized: () => safeInvoke('window-is-maximized'),

  // プラットフォーム情報
  getPlatform: () => safeInvoke('get-platform'),

  // 自動更新
  checkForUpdates: () => safeInvoke('check-for-updates'),
  downloadUpdate: () => safeInvoke('download-update'),
  installUpdate: () => safeInvoke('install-update'),
  getCurrentVersion: () => safeInvoke('get-current-version'),
  onUpdateStatus: (callback) => safeOn('update-status', callback),
});

const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('unitone', {
  // サービス管理
  getServices: () => ipcRenderer.invoke('get-services'),
  addService: (service) => ipcRenderer.invoke('add-service', service),
  removeService: (serviceId) => ipcRenderer.invoke('remove-service', serviceId),
  updateService: (service) => ipcRenderer.invoke('update-service', service),
  reorderServices: (services) => ipcRenderer.invoke('reorder-services', services),
  updateServiceUrl: (serviceId, url) => ipcRenderer.invoke('update-service-url', serviceId, url),

  // アクティブサービス
  getActiveService: () => ipcRenderer.invoke('get-active-service'),
  setActiveService: (serviceId) => ipcRenderer.invoke('set-active-service', serviceId),

  // AIコンパニオン
  getShowAiCompanion: () => ipcRenderer.invoke('get-show-ai-companion'),
  setShowAiCompanion: (show) => ipcRenderer.invoke('set-show-ai-companion', show),
  getAiWidth: () => ipcRenderer.invoke('get-ai-width'),
  setAiWidth: (width) => ipcRenderer.invoke('set-ai-width', width),

  // AIサービス管理
  getAiServices: () => ipcRenderer.invoke('get-ai-services'),
  getActiveAiService: () => ipcRenderer.invoke('get-active-ai-service'),
  setActiveAiService: (serviceId) => ipcRenderer.invoke('set-active-ai-service', serviceId),
  addAiService: (service) => ipcRenderer.invoke('add-ai-service', service),
  removeAiService: (serviceId) => ipcRenderer.invoke('remove-ai-service', serviceId),

  // 通知バッジ
  updateBadge: (serviceId, count) => ipcRenderer.send('update-badge', { serviceId, count }),
  onBadgeUpdated: (callback) => {
    ipcRenderer.on('badge-updated', (event, data) => callback(data));
  },

  // AIに送る
  onSendToAi: (callback) => {
    ipcRenderer.on('send-to-ai', (event, text) => callback(text));
  },

  // 認証完了
  onAuthCompleted: (callback) => {
    ipcRenderer.on('auth-completed', (event, url) => callback(url));
  },

  // ウィンドウ操作（Windows用カスタムタイトルバー）
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // プラットフォーム情報
  getPlatform: () => ipcRenderer.invoke('get-platform')
});

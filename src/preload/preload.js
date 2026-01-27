const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスに公開するAPI
contextBridge.exposeInMainWorld('unitone', {
  // サービス管理
  getServices: () => ipcRenderer.invoke('get-services'),
  addService: (service) => ipcRenderer.invoke('add-service', service),
  removeService: (serviceId) => ipcRenderer.invoke('remove-service', serviceId),
  updateService: (service) => ipcRenderer.invoke('update-service', service),

  // アクティブサービス
  getActiveService: () => ipcRenderer.invoke('get-active-service'),
  setActiveService: (serviceId) => ipcRenderer.invoke('set-active-service', serviceId),

  // AIコンパニオン
  getGeminiUrl: () => ipcRenderer.invoke('get-gemini-url'),
  getShowAiCompanion: () => ipcRenderer.invoke('get-show-ai-companion'),
  setShowAiCompanion: (show) => ipcRenderer.invoke('set-show-ai-companion', show),

  // 通知バッジ
  updateBadge: (serviceId, count) => ipcRenderer.send('update-badge', { serviceId, count }),
  onBadgeUpdated: (callback) => {
    ipcRenderer.on('badge-updated', (event, data) => callback(data));
  }
});

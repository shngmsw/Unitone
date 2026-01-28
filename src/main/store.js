const Store = require('electron-store');

// プラットフォーム判定
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// 設定ストア
const store = new Store({
  defaults: {
    services: [
      { id: 'slack', name: 'Slack', url: 'https://app.slack.com', icon: '💬', enabled: true },
      { id: 'gchat', name: 'Google Chat', url: 'https://chat.google.com', icon: '💭', enabled: true },
      { id: 'teams', name: 'Teams', url: 'https://teams.microsoft.com', icon: '👥', enabled: true },
      { id: 'chatwork', name: 'Chatwork', url: 'https://www.chatwork.com', icon: '📝', enabled: true }
    ],
    aiServices: [
      { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', isDefault: true },
      { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', isDefault: true },
      { id: 'claude', name: 'Claude', url: 'https://claude.ai', isDefault: true }
    ],
    activeAiServiceId: 'gemini',
    windowBounds: { width: 1400, height: 900 },
    activeServiceId: 'slack',
    showAiCompanion: true,
    aiWidth: 400
  }
});

module.exports = {
  store,
  isMac,
  isWindows,
  isLinux
};

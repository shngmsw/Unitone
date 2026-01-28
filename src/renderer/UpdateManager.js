// UpdateManager - 自動更新の通知UI管理

export class UpdateManager {
  constructor() {
    this.banner = document.getElementById('update-banner');
    this.message = document.getElementById('update-message');
    this.progress = document.getElementById('update-progress');
    this.progressBar = document.getElementById('update-progress-bar');
    this.actions = document.getElementById('update-actions');

    this.setup();
  }

  setup() {
    window.unitone.onUpdateStatus((data) => {
      this.handleUpdateStatus(data);
    });
  }

  handleUpdateStatus({ status, data }) {
    switch (status) {
      case 'checking':
        // チェック中は通知しない
        break;

      case 'available':
        this.showUpdateAvailable(data);
        break;

      case 'not-available':
        this.hide();
        break;

      case 'progress':
        this.showDownloadProgress(data);
        break;

      case 'downloaded':
        this.showUpdateReady(data);
        break;

      case 'error':
        this.showError(data);
        break;
    }
  }

  showUpdateAvailable(info) {
    this.message.textContent = `新しいバージョン v${info.version} が利用可能です`;
    this.progress.classList.add('hidden');
    this.actions.innerHTML = `
      <button class="update-btn-secondary" id="update-later-btn">後で</button>
      <button class="update-btn-primary" id="update-download-btn">ダウンロード</button>
    `;

    document.getElementById('update-later-btn').onclick = () => this.hide();
    document.getElementById('update-download-btn').onclick = () => this.startDownload();

    this.show();
  }

  showDownloadProgress(progress) {
    const percent = Math.round(progress.percent || 0);
    this.message.textContent = `ダウンロード中... ${percent}%`;
    this.progress.classList.remove('hidden');
    this.progressBar.style.width = `${percent}%`;
    this.actions.innerHTML = '';
    this.show();
  }

  showUpdateReady(info) {
    this.message.textContent = `アップデートの準備ができました (v${info.version})`;
    this.progress.classList.add('hidden');
    this.actions.innerHTML = `
      <button class="update-btn-secondary" id="update-later-btn">後で再起動</button>
      <button class="update-btn-primary" id="update-install-btn">今すぐ再起動</button>
    `;

    document.getElementById('update-later-btn').onclick = () => this.hide();
    document.getElementById('update-install-btn').onclick = () => this.installUpdate();

    this.show();
  }

  showError(message) {
    this.message.textContent = `更新エラー: ${message}`;
    this.progress.classList.add('hidden');
    this.actions.innerHTML = `
      <button class="update-btn-secondary" id="update-close-btn">閉じる</button>
    `;

    document.getElementById('update-close-btn').onclick = () => this.hide();

    this.show();

    // 5秒後に自動で閉じる
    setTimeout(() => this.hide(), 5000);
  }

  async startDownload() {
    await window.unitone.downloadUpdate();
  }

  async installUpdate() {
    await window.unitone.installUpdate();
  }

  show() {
    this.banner.classList.remove('hidden');
  }

  hide() {
    this.banner.classList.add('hidden');
  }
}

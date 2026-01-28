// LoadingManager.js - ローディング表示管理

export class LoadingManager {
  constructor() {
    this.loadingTimer = null;
  }

  show() {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      indicator.classList.remove('hidden');
    }
  }

  showDelayed(delay = 500) {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }
    this.loadingTimer = setTimeout(() => {
      this.show();
    }, delay);
  }

  hide() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
      this.loadingTimer = null;
    }
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }
}

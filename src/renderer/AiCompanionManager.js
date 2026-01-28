// AiCompanionManager.js - AIコンパニオン管理

export class AiCompanionManager {
  constructor(unitone) {
    this.unitone = unitone;
  }

  // XSS対策: HTMLエスケープ
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async setup(show, width) {
    const aiCompanion = document.getElementById('ai-companion');
    const aiWebview = document.getElementById('ai-webview');

    if (!aiCompanion || !aiWebview) return;

    // 幅を設定（300-800pxの範囲でバリデーション）
    if (width) {
      const minWidth = 300;
      const maxWidth = 800;
      const validWidth = Math.max(minWidth, Math.min(maxWidth, width));
      aiCompanion.style.width = `${validWidth}px`;
    }

    // AIセレクターを初期化
    this.renderDropdown();
    this.updateSelectorDisplay();

    if (show) {
      aiCompanion.classList.remove('hidden');
      if (aiWebview.src === 'about:blank' && this.unitone.activeAiService) {
        aiWebview.src = this.unitone.activeAiService.url;
      }
    } else {
      aiCompanion.classList.add('hidden');
    }
  }

  toggle() {
    const aiCompanion = document.getElementById('ai-companion');
    if (!aiCompanion) return;

    const isHidden = aiCompanion.classList.toggle('hidden');
    window.unitone.setShowAiCompanion(!isHidden);

    if (!isHidden) {
      const aiWebview = document.getElementById('ai-webview');
      if (aiWebview && aiWebview.src === 'about:blank' && this.unitone.activeAiService) {
        aiWebview.src = this.unitone.activeAiService.url;
      }
    }
  }

  updateSelectorDisplay() {
    const nameElement = document.getElementById('ai-current-name');
    if (nameElement && this.unitone.activeAiService) {
      nameElement.textContent = this.unitone.activeAiService.name;
    }
  }

  renderDropdown() {
    const list = document.getElementById('ai-dropdown-list');
    if (!list) return;

    list.innerHTML = this.unitone.aiServices.map(service => {
      const isActive = this.unitone.activeAiService && service.id === this.unitone.activeAiService.id;
      const escapedId = this.escapeHtml(service.id);
      const escapedName = this.escapeHtml(service.name);
      const deleteBtn = service.isDefault ? '' : `<button class="delete-ai-btn" data-id="${escapedId}" title="削除">×</button>`;
      return `
        <div class="ai-dropdown-item ${isActive ? 'active' : ''}" data-id="${escapedId}">
          <span>${escapedName}</span>
          ${deleteBtn}
        </div>
      `;
    }).join('');

    // クリックイベントを設定
    list.querySelectorAll('.ai-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-ai-btn')) return;
        this.switchService(item.dataset.id);
      });
    });

    // 削除ボタンのイベント
    list.querySelectorAll('.delete-ai-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.removeService(btn.dataset.id);
      });
    });
  }

  async switchService(serviceId) {
    const service = this.unitone.aiServices.find(s => s.id === serviceId);
    if (!service) return;

    this.unitone.activeAiService = await window.unitone.setActiveAiService(serviceId);
    this.updateSelectorDisplay();
    this.renderDropdown();
    this.toggleDropdown(false);

    const aiWebview = document.getElementById('ai-webview');
    if (aiWebview) {
      aiWebview.src = service.url;
    }
  }

  async removeService(serviceId) {
    this.unitone.aiServices = await window.unitone.removeAiService(serviceId);
    this.unitone.activeAiService = await window.unitone.getActiveAiService();
    this.renderDropdown();
    this.updateSelectorDisplay();
  }

  toggleDropdown(show = null) {
    const dropdown = document.getElementById('ai-dropdown');
    if (!dropdown) return;

    if (show === null) {
      dropdown.classList.toggle('hidden');
    } else {
      dropdown.classList.toggle('hidden', !show);
    }
  }

  sendToAi(text) {
    const aiCompanion = document.getElementById('ai-companion');
    if (aiCompanion && aiCompanion.classList.contains('hidden')) {
      this.toggle();
    }

    const aiWebview = document.getElementById('ai-webview');
    if (!aiWebview) return;

    const tryInsertText = () => {
      aiWebview.executeJavaScript(`
        (function() {
          const textareas = document.querySelectorAll('textarea, [contenteditable="true"], .ql-editor, [role="textbox"]');
          for (const el of textareas) {
            if (el.offsetParent !== null) {
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
          console.log('AIの入力欄が見つかりませんでした。クリップボードにコピーしました。');
          navigator.clipboard.writeText(text);
        }
      }).catch(err => {
        console.error('AIへの送信に失敗:', err);
        navigator.clipboard.writeText(text);
      });
    };

    if (aiWebview.src !== 'about:blank') {
      tryInsertText();
    } else {
      aiWebview.addEventListener('dom-ready', tryInsertText, { once: true });
    }
  }

  setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const aiCompanion = document.getElementById('ai-companion');

    if (!resizeHandle || !aiCompanion) {
      return;
    }

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let animationFrameId = null;

    const computedStyle = getComputedStyle(document.documentElement);
    const minWidth = parseInt(computedStyle.getPropertyValue('--ai-min-width')) || 300;
    const maxWidth = parseInt(computedStyle.getPropertyValue('--ai-max-width')) || 800;

    const onMouseMove = (e) => {
      if (!isResizing || aiCompanion.classList.contains('hidden')) return;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const deltaX = startX - e.clientX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
        aiCompanion.style.width = `${newWidth}px`;
      });
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        aiCompanion.classList.remove('resizing');
        document.body.classList.remove('resizing-active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        const currentWidth = aiCompanion.offsetWidth;
        window.unitone.setAiWidth(currentWidth).catch(err => {
          console.warn('AI幅の保存に失敗しました:', err);
        });
      }
    };

    resizeHandle.addEventListener('mousedown', (e) => {
      if (aiCompanion.classList.contains('hidden')) {
        return;
      }

      isResizing = true;
      startX = e.clientX;
      startWidth = aiCompanion.offsetWidth;
      aiCompanion.classList.add('resizing');
      document.body.classList.add('resizing-active');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // キーボードアクセシビリティ
    resizeHandle.addEventListener('keydown', (e) => {
      if (aiCompanion.classList.contains('hidden')) return;

      const step = 10;
      let currentWidth = aiCompanion.offsetWidth;
      let newWidth = currentWidth;

      if (e.key === 'ArrowLeft') {
        newWidth = Math.min(maxWidth, currentWidth + step);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        newWidth = Math.max(minWidth, currentWidth - step);
        e.preventDefault();
      }

      if (newWidth !== currentWidth) {
        aiCompanion.style.width = `${newWidth}px`;
        window.unitone.setAiWidth(newWidth).catch(err => {
          console.warn('AI幅の保存に失敗しました:', err);
        });
      }
    });
  }
}

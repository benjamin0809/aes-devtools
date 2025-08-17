/* UI模块 */

// UI管理器类
class UIManager {
  constructor() {
    this.currentTab = 'network';
    this.init();
  }
  
  init() {
    this.setupTabSwitching();
    this.setupHelpSystem();
    this.loadTheme();
  }
  
  setupTabSwitching() {
    // 网络标签页
    const networkTab = document.querySelector('[data-tab="network"]');
    if (networkTab) {
      networkTab.addEventListener('click', () => {
        this.switchTab('network');
      });
    }
    
    // 存储标签页
    const storageTab = document.querySelector('[data-tab="storage"]');
    if (storageTab) {
      storageTab.addEventListener('click', () => {
        this.switchTab('storage');
      });
    }
  }
  
  switchTab(tabName) {
    // 隐藏所有面板
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // 移除所有标签页的激活状态
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // 显示选中的面板
    const panel = document.getElementById(`${tabName}-panel`);
    if (panel) {
      panel.classList.add('active');
    }
    
    // 激活选中的标签页
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.classList.add('active');
    }
    
    this.currentTab = tabName;
    
    // 保存当前标签页到localStorage
    localStorage.setItem('devtools-current-tab', tabName);
  }
  
  setupHelpSystem() {
    const helpModal = document.getElementById('help-modal');
    const closeHelpBtn = document.querySelector('.close-btn');
    
    if (closeHelpBtn) {
      closeHelpBtn.addEventListener('click', () => this.hideHelp());
    }
    
    // 点击模态框外部关闭
    if (helpModal) {
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
          this.hideHelp();
        }
      });
    }
    
    // ESC键关闭帮助
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideHelp();
      }
    });
  }
  
  showHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.style.display = 'block';
    }
  }
  
  hideHelp() {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  loadTheme() {
    if (typeof loadTheme === 'function') {
      loadTheme();
    }
  }
  
  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // 自动隐藏
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
  
  showConfirmDialog(message, onConfirm, onCancel) {
    const confirmModal = document.getElementById('confirm-modal');
    if (!confirmModal) return;
    
    const messageEl = document.getElementById('confirm-message');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    
    if (messageEl) messageEl.textContent = message;
    
    // 绑定事件
    if (yesBtn) {
      yesBtn.onclick = () => {
        this.hideConfirmDialog();
        if (onConfirm) onConfirm();
      };
    }
    
    if (noBtn) {
      noBtn.onclick = () => {
        this.hideConfirmDialog();
        if (onCancel) onCancel();
      };
    }
    
    confirmModal.style.display = 'block';
  }
  
  hideConfirmDialog() {
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.style.display = 'none';
    }
  }
  
  showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'flex';
    }
  }
  
  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }
  
  updateTitle(title) {
    if (document.title !== title) {
      document.title = title;
    }
  }
  
  updateFavicon(iconPath) {
    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = iconPath;
    document.getElementsByTagName('head')[0].appendChild(link);
  }
  
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
  
  showErrorPage(error) {
    const app = document.getElementById('app');
    if (!app) return;
    
    app.innerHTML = `
      <div class="error-page">
        <div class="error-icon">⚠️</div>
        <h1>出错了！</h1>
        <p>${error.message || '发生未知错误'}</p>
        <button onclick="location.reload()">重新加载</button>
      </div>
    `;
  }
  
  showEmptyState(message, icon = '📋') {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <p>${message}</p>
      </div>
    `;
  }
  
  createTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    element.addEventListener('mouseenter', () => {
      document.body.appendChild(tooltip);
      const rect = element.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + 'px';
      tooltip.style.top = rect.top - 30 + 'px';
    });
    
    element.addEventListener('mouseleave', () => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    });
  }
  
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
  
  createModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${buttons.length > 0 ? `
          <div class="modal-footer">
            ${buttons.map(btn => `
              <button class="btn btn-${btn.type || 'secondary'}" data-action="${btn.action}">
                ${btn.text}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }
    
    // 绑定按钮事件
    buttons.forEach(btn => {
      const button = modal.querySelector(`[data-action="${btn.action}"]`);
      if (button && btn.onClick) {
        button.addEventListener('click', () => {
          btn.onClick();
          modal.remove();
        });
      }
    });
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
    return modal;
  }
  
  destroy() {
    // 清理事件监听器
    document.removeEventListener('keydown', this.handleKeydown);
  }
}

// 将类暴露到全局作用域
window.UIManager = UIManager;

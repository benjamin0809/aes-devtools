/* AES DevTools 主入口文件 */

// 全局变量
let networkManager;
let storageManager;
let uiManager;

// 主初始化函数
async function init() {
  try {
    // 等待所有模块加载完成
    await waitForModules();
    
    // 加载主题
    if (typeof loadTheme === 'function') {
      loadTheme();
    }
    
    // 初始化UI管理器
    if (typeof UIManager === 'function') {
      uiManager = new UIManager();
    }
    
    // 设置标签页切换
    setupMainTabSwitching();
    
    // 设置搜索历史功能
    setupSearchHistory();
    
    // 设置上下文菜单
    setupContextMenu();
    
    // 延迟初始化网络和存储管理器，等待Chrome API
    setTimeout(() => {
      try {
        // 初始化网络管理器
        if (typeof NetworkManager === 'function') {
          networkManager = new NetworkManager();
        }
        
        // 初始化存储管理器
        if (typeof StorageManager === 'function') {
          storageManager = new StorageManager();
        }
        
        console.log('网络和存储管理器初始化完成');
      } catch (error) {
        console.warn('网络和存储管理器初始化失败:', error);
      }
    }, 500);
    
    console.log('AES DevTools 初始化完成');
    
  } catch (error) {
    console.error('AES DevTools 初始化失败:', error);
    if (uiManager && typeof uiManager.showErrorPage === 'function') {
      uiManager.showErrorPage(error);
    }
  }
}

// 等待模块加载
function waitForModules() {
  return new Promise((resolve) => {
    const checkModules = () => {
      if (typeof UIManager === 'function' && 
          typeof NetworkManager === 'function' && 
          typeof StorageManager === 'function' &&
          typeof loadTheme === 'function') {
        resolve();
      } else {
        setTimeout(checkModules, 100);
      }
    };
    checkModules();
  });
}

// 设置主标签页切换
function setupMainTabSwitching() {
  const mainTabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');
  
  mainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // 更新标签页状态
      mainTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 更新面板显示
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `${targetTab}-panel`) {
          panel.classList.add('active');
        }
      });
      
      // 保存当前标签页
      localStorage.setItem('devtools-main-tab', targetTab);
    });
  });
  
  // 恢复上次选择的标签页
  const lastTab = localStorage.getItem('devtools-main-tab') || 'network';
  const lastTabBtn = document.querySelector(`[data-tab="${lastTab}"]`);
  if (lastTabBtn) {
    lastTabBtn.click();
  }
}

// 设置搜索历史功能
function setupSearchHistory() {
  const searchHistoryBtn = document.getElementById('searchHistoryBtn');
  const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
  const clearSearchHistory = document.getElementById('clearSearchHistory');
  const searchHistoryList = document.getElementById('searchHistoryList');
  
  if (!searchHistoryBtn || !searchHistoryDropdown) return;
  
  // 切换搜索历史显示
  searchHistoryBtn.addEventListener('click', () => {
    searchHistoryDropdown.classList.toggle('show');
  });
  
  // 点击外部关闭
  document.addEventListener('click', (e) => {
    if (!searchHistoryBtn.contains(e.target) && !searchHistoryDropdown.contains(e.target)) {
      searchHistoryDropdown.classList.remove('show');
    }
  });
  
  // 清空搜索历史
  if (clearSearchHistory) {
    clearSearchHistory.addEventListener('click', () => {
      if (typeof clearSearchHistoryData === 'function') {
        clearSearchHistoryData();
      }
      searchHistoryDropdown.classList.remove('show');
    });
  }
  
  // 搜索历史点击事件
  if (searchHistoryList) {
    searchHistoryList.addEventListener('click', (e) => {
      if (e.target.classList.contains('search-history-item')) {
        const searchText = e.target.dataset.search;
        if (searchText && typeof setSearchText === 'function') {
          setSearchText(searchText);
        }
        searchHistoryDropdown.classList.remove('show');
      }
    });
  }
}

// 设置上下文菜单
function setupContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  
  // 隐藏上下文菜单
  document.addEventListener('click', () => {
    contextMenu.classList.remove('show');
  });
  
  // 阻止右键菜单默认行为
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.request-item')) {
      e.preventDefault();
    }
  });
  
  // 显示上下文菜单
  document.addEventListener('contextmenu', (e) => {
    const requestItem = e.target.closest('.request-item');
    if (requestItem) {
      e.preventDefault();
      showContextMenu(e, requestItem);
    }
  });
  
  // 处理上下文菜单点击
  contextMenu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action && typeof handleContextMenuAction === 'function') {
      handleContextMenuAction(action);
    }
    contextMenu.classList.remove('show');
  });
}

// 显示上下文菜单
function showContextMenu(e, requestItem) {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  
  // 设置菜单位置
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
  
  // 存储当前请求项
  contextMenu.dataset.requestId = requestItem.dataset.id;
  
  // 显示菜单
  contextMenu.classList.add('show');
}

// 处理上下文菜单操作
function handleContextMenuAction(action) {
  const contextMenu = document.getElementById('contextMenu');
  const requestId = contextMenu.dataset.requestId;
  
  if (!requestId) return;
  
  switch (action) {
    case 'copy-url':
      if (typeof copyRequestUrl === 'function') {
        copyRequestUrl(requestId);
      }
      break;
    case 'copy-request':
      if (typeof copyRequestData === 'function') {
        copyRequestData(requestId);
      }
      break;
    case 'copy-response':
      if (typeof copyResponseData === 'function') {
        copyResponseData(requestId);
      }
      break;
    case 'copy-decrypted':
      if (typeof copyDecryptedData === 'function') {
        copyDecryptedData(requestId);
      }
      break;
    case 'export-request':
      if (typeof exportRequestData === 'function') {
        exportRequestData(requestId);
      }
      break;
  }
}

// 设置搜索历史
function setSearchText(searchText) {
  const filterInput = document.getElementById('filter');
  if (filterInput) {
    filterInput.value = searchText;
    filterInput.dispatchEvent(new Event('input'));
  }
}

// 全局函数，供其他模块调用
window.copyTextToClipboard = function(text) {
  if (typeof copyTextToClipboard === 'function') {
    return copyTextToClipboard(text);
  }
  // 备用实现
  navigator.clipboard.writeText(text).then(() => {
    console.log('文本已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
  });
};

window.exportData = function(data, filename) {
  if (typeof exportData === 'function') {
    return exportData(data, filename);
  }
  // 备用实现
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.json';
  a.click();
  URL.revokeObjectURL(url);
};

window.showNotification = function(message, type = 'info') {
  if (typeof showNotification === 'function') {
    return showNotification(message, type);
  }
  // 备用实现
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
};

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 
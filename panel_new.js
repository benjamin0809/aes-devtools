/* AES DevTools 主入口文件 */

import { NetworkManager } from './js/network.js';
import { StorageManager } from './js/storage.js';
import { UIManager } from './js/ui.js';
import { loadTheme } from './js/utils.js';

// 全局变量
let networkManager;
let storageManager;
let uiManager;

// 主初始化函数
async function init() {
  try {
    // 加载主题
    loadTheme();
    
    // 初始化UI管理器
    uiManager = new UIManager();
    
    // 初始化网络管理器
    networkManager = new NetworkManager();
    
    // 初始化存储管理器
    storageManager = new StorageManager();
    
    // 设置标签页切换
    setupMainTabSwitching();
    
    // 设置搜索历史功能
    setupSearchHistory();
    
    // 设置上下文菜单
    setupContextMenu();
    
    console.log('AES DevTools 初始化完成');
    
  } catch (error) {
    console.error('AES DevTools 初始化失败:', error);
    uiManager?.showErrorPage(error);
  }
}

// 设置主标签页切换
function setupMainTabSwitching() {
  const mainTabs = document.querySelectorAll('.main-tab');
  const mainContents = document.querySelectorAll('.main-content');
  
  mainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.mainTab;
      
      // 更新标签页状态
      mainTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 更新内容显示
      mainContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-content`) {
          content.classList.add('active');
        }
      });
      
      // 保存当前标签页
      localStorage.setItem('devtools-main-tab', targetTab);
    });
  });
  
  // 恢复上次选择的标签页
  const lastTab = localStorage.getItem('devtools-main-tab') || 'network';
  const lastTabBtn = document.querySelector(`[data-main-tab="${lastTab}"]`);
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
      localStorage.removeItem('devtools-search-history');
      updateSearchHistoryDisplay();
    });
  }
  
  // 更新搜索历史显示
  function updateSearchHistoryDisplay() {
    if (!searchHistoryList) return;
    
    try {
      const history = JSON.parse(localStorage.getItem('devtools-search-history') || '[]');
      
      if (history.length === 0) {
        searchHistoryList.innerHTML = '<div class="search-history-item" style="color: var(--muted); text-align: center; padding: 16px;">暂无搜索历史</div>';
        return;
      }
      
      searchHistoryList.innerHTML = history.map(item => {
        const time = new Date(item.timestamp);
        const timeStr = time.toLocaleString();
        return `
          <div class="search-history-item" data-text="${item.text}">
            <div class="search-text">${item.text}</div>
            <div class="search-time">${timeStr}</div>
          </div>
        `;
      }).join('');
      
      // 添加点击事件
      searchHistoryList.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
          const searchText = item.dataset.text;
          const filterInput = document.getElementById('filter');
          if (filterInput) {
            filterInput.value = searchText;
            filterInput.dispatchEvent(new Event('input'));
          }
          searchHistoryDropdown.classList.remove('show');
        });
      });
      
    } catch (error) {
      console.error('更新搜索历史显示失败:', error);
    }
  }
  
  // 初始显示
  updateSearchHistoryDisplay();
}

// 设置上下文菜单
function setupContextMenu() {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  
  // 右键菜单事件
  document.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('tr[data-id]');
    if (target) {
      e.preventDefault();
      showContextMenu(e, target);
    }
  });
  
  // 点击其他地方隐藏菜单
  document.addEventListener('click', () => {
    contextMenu.classList.remove('show');
  });
  
  // 处理菜单项点击
  contextMenu.addEventListener('click', (e) => {
    const menuItem = e.target.closest('.context-menu-item');
    if (menuItem) {
      const action = menuItem.dataset.action;
      handleContextMenuAction(action);
      contextMenu.classList.remove('show');
    }
  });
}

// 显示上下文菜单
function showContextMenu(e, target) {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;
  
  contextMenu.style.display = 'block';
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
  contextMenu.classList.add('show');
  
  // 保存目标元素
  contextMenu.dataset.targetId = target.dataset.id;
}

// 处理上下文菜单操作
function handleContextMenuAction(action) {
  const contextMenu = document.getElementById('contextMenu');
  const targetId = contextMenu?.dataset.targetId;
  
  if (!targetId) return;
  
  const record = networkManager?.allRecords.find(r => r.id == targetId);
  if (!record) return;
  
  switch (action) {
    case 'copy-url':
      copyTextToClipboard(record.request.url);
      break;
    case 'copy-request':
      copyTextToClipboard(JSON.stringify(record.request, null, 2));
      break;
    case 'copy-response':
      if (record.response) {
        copyTextToClipboard(JSON.stringify(record.response, null, 2));
      }
      break;
    case 'export-single':
      exportData(record, `request-${record.id}.json`);
      break;
  }
}

// 复制文本到剪贴板
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showNotification('已复制到剪贴板', 'success');
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        textArea.remove();
        showNotification('已复制到剪贴板', 'success');
      } catch (err) {
        textArea.remove();
        showNotification('复制失败', 'error');
      }
    }
  } catch (error) {
    console.error('复制失败:', error);
    showNotification('复制失败', 'error');
  }
}

// 导出数据
function exportData(data, filename) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('导出成功', 'success');
  } catch (error) {
    console.error('导出失败:', error);
    showNotification('导出失败', 'error');
  }
}

// 显示通知
function showNotification(message, type = 'info') {
  uiManager?.showNotification(message, type);
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 导出全局函数供HTML使用
window.copyTextToClipboard = copyTextToClipboard;
window.exportData = exportData;
window.showNotification = showNotification; 
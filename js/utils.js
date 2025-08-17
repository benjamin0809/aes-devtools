/* 工具函数模块 */

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 复制文本到剪贴板
function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
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
      return Promise.resolve();
    } catch (err) {
      textArea.remove();
      return Promise.reject(err);
    }
  }
}

// 显示临时复制成功提示
function showTemporaryCopySuccess(button) {
  if (!button) return;
  
  const originalText = button.textContent;
  button.textContent = '已复制!';
  button.style.background = 'var(--success)';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = '';
  }, 1500);
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深拷贝对象
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// 验证JSON字符串
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

// 美化JSON
function beautifyJSON(json, indent = 2) {
  try {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    return JSON.stringify(json, null, indent);
  } catch (e) {
    return json;
  }
}

// 压缩JSON
function minifyJSON(json) {
  try {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    return JSON.stringify(json);
  } catch (e) {
    return json;
  }
}

// 主题管理
function getCurrentTheme() {
  return localStorage.getItem('devtools-theme') || 'light';
}

function setTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devtools-theme', theme);
    
    // 更新主题切换按钮图标
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
  }
}

function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function loadTheme() {
  const savedTheme = getCurrentTheme();
  setTheme(savedTheme);
}

// 数据导出
function exportData(data, filename = 'export.json') {
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
    return true;
  } catch (error) {
    console.error('导出失败:', error);
    return false;
  }
}

// 数据导入
function importFileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('文件格式错误，请选择有效的JSON文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

// 搜索历史管理类
class SearchHistoryManager {
  constructor(maxHistory = 20) {
    this.maxHistory = maxHistory;
    this.history = this.loadHistory();
  }
  
  loadHistory() {
    try {
      const saved = localStorage.getItem('devtools-search-history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('加载搜索历史失败:', e);
      return [];
    }
  }
  
  saveHistory() {
    try {
      localStorage.setItem('devtools-search-history', JSON.stringify(this.history));
    } catch (e) {
      console.warn('保存搜索历史失败:', e);
    }
  }
  
  addSearch(text) {
    if (!text.trim()) return;
    
    // 移除重复项
    this.history = this.history.filter(item => item.text !== text);
    
    // 添加到开头
    this.history.unshift({
      text: text,
      timestamp: Date.now()
    });
    
    // 限制数量
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
    
    this.saveHistory();
  }
  
  getHistory() {
    return this.history;
  }
  
  clearHistory() {
    this.history = [];
    this.saveHistory();
  }
  
  removeItem(text) {
    this.history = this.history.filter(item => item.text !== text);
    this.saveHistory();
  }
}

// 将函数暴露到全局作用域
window.escapeRegExp = escapeRegExp;
window.copyTextToClipboard = copyTextToClipboard;
window.showTemporaryCopySuccess = showTemporaryCopySuccess;
window.formatTime = formatTime;
window.formatFileSize = formatFileSize;
window.debounce = debounce;
window.throttle = throttle;
window.generateId = generateId;
window.deepClone = deepClone;
window.isValidJSON = isValidJSON;
window.beautifyJSON = beautifyJSON;
window.minifyJSON = minifyJSON;
window.getCurrentTheme = getCurrentTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.loadTheme = loadTheme;
window.exportData = exportData;
window.importFileData = importFileData;
window.SearchHistoryManager = SearchHistoryManager;

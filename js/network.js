/* 网络模块 */

// 网络管理器类
class NetworkManager {
  constructor() {
    this.rowsEl = document.getElementById('rows');
    this.tableEl = document.getElementById('table');
    this.paneEl = document.getElementById('pane');
    this.filterEl = document.getElementById('filter');
    this.suffixFilterEl = document.getElementById('suffix-filter');
    this.suffixModeEl = document.getElementById('suffix-mode');
    this.methodEl = document.getElementById('method');
    this.toggleEl = document.getElementById('toggle');
    this.clearEl = document.getElementById('clear');
    this.exportEl = document.getElementById('export');
    this.captureBodiesEl = document.getElementById('captureBodies');
    this.enableAESDecryptEl = document.getElementById('enableAESDecrypt');
    this.applyAESDecryptEl = document.getElementById('applyAESDecrypt');
    
    this.isPaused = false;
    this.allRecords = [];
    this.displayedRecords = [];
    this.selectedId = null;
    this.pendingByKey = new Map();
    this.pendingRequests = new Map();
    this.requestCounter = 0;
    
    // 网络统计
    this.networkStats = {
      total: 0,
      success: 0,
      warning: 0,
      error: 0,
      pending: 0,
      startTime: Date.now()
    };
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.setupNetworkCapture();
    this.updateNetworkStats();
    this.startRealTimeUpdates();
    
    // 添加一些模拟数据用于测试
    this.addSampleData();
  }
  
  addSampleData() {
    // 添加示例网络请求数据
    const sampleRequests = [
      {
        id: 'sample_1',
        request: {
          method: 'GET',
          url: 'https://example.com/api/users',
          requestId: 'sample_1'
        },
        response: {
          status: 200,
          statusText: 'OK'
        },
        timestamp: Date.now() - 5000,
        status: 'success',
        finished: true
      },
      {
        id: 'sample_2',
        request: {
          method: 'POST',
          url: 'https://example.com/api/login',
          requestId: 'sample_2'
        },
        response: {
          status: 401,
          statusText: 'Unauthorized'
        },
        timestamp: Date.now() - 3000,
        status: 'error',
        finished: true
      }
    ];
    
    this.allRecords = sampleRequests;
    this.displayedRecords = sampleRequests;
    this.updateDisplay();
    this.updateNetworkStats();
    
    console.log('已添加示例数据:', sampleRequests);
  }
  
  setupEventListeners() {
    // 过滤相关
    if (this.filterEl) {
      this.filterEl.addEventListener('input', () => this.filterRecords());
    }
    if (this.suffixFilterEl) {
      this.suffixFilterEl.addEventListener('input', () => this.filterRecords());
    }
    if (this.suffixModeEl) {
      this.suffixModeEl.addEventListener('change', () => this.filterRecords());
    }
    if (this.methodEl) {
      this.methodEl.addEventListener('change', () => this.filterRecords());
    }
    
    // 控制按钮
    if (this.toggleEl) {
      this.toggleEl.addEventListener('click', () => this.toggleCapture());
    }
    if (this.clearEl) {
      this.clearEl.addEventListener('click', () => this.clearRecords());
    }
    if (this.exportEl) {
      this.exportEl.addEventListener('click', () => this.exportRecords());
    }
    
    // 使用正确的按钮ID
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearRecords());
    }
    
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportRecords());
    }
    if (this.captureBodiesEl) {
      this.captureBodiesEl.addEventListener('change', () => this.toggleBodyCapture());
    }
    
    // AES解密
    if (this.enableAESDecryptEl) {
      this.enableAESDecryptEl.addEventListener('change', () => this.toggleAESDecrypt());
    }
    if (this.applyAESDecryptEl) {
      this.applyAESDecryptEl.addEventListener('click', () => this.applyAESDecrypt());
    }
    
    // 批量操作
    const batchDecryptBtn = document.getElementById('batch-decrypt-btn');
    if (batchDecryptBtn) {
      batchDecryptBtn.addEventListener('click', () => this.batchDecrypt());
    }
    
    // 搜索历史
    const searchHistoryBtn = document.getElementById('searchHistoryBtn');
    if (searchHistoryBtn) {
      searchHistoryBtn.addEventListener('click', () => this.toggleSearchHistory());
    }
    
    // 帮助系统
    const helpBtn = document.querySelector('.help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }
    
    // 上下文菜单
    this.setupContextMenu();
    
    // 键盘快捷键
    this.setupKeyboardShortcuts();
  }
  
  setupNetworkCapture() {
    // 等待Chrome DevTools API初始化
    const setupListeners = () => {
      if (chrome && chrome.devtools && chrome.devtools.network) {
        try {
          chrome.devtools.network.onRequestWillBeSent.addListener(
            (request) => this.onRequestWillBeSent(request)
          );
          
          chrome.devtools.network.onResponseReceived.addListener(
            (response) => this.onResponseReceived(response)
          );
          
          chrome.devtools.network.onRequestFinished.addListener(
            (request) => this.onRequestFinished(request)
          );
          
          console.log('网络监听器设置成功');
        } catch (error) {
          console.error('设置网络监听器失败:', error);
        }
      } else {
        // 如果API还没准备好，延迟重试
        setTimeout(setupListeners, 100);
      }
    };
    
    setupListeners();
  }
  
  onRequestWillBeSent(request) {
    if (this.isPaused) return;
    
    const record = {
      id: this.generateRequestId(),
      request: request,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    this.allRecords.unshift(record);
    this.pendingRequests.set(request.requestId, record);
    this.updateDisplay();
    this.updateNetworkStats();
  }
  
  onResponseReceived(response) {
    const record = this.pendingRequests.get(response.requestId);
    if (record) {
      record.response = response;
      record.status = response.status < 400 ? 'success' : 'error';
      this.updateDisplay();
      this.updateNetworkStats();
    }
  }
  
  onRequestFinished(request) {
    const record = this.pendingRequests.get(request.requestId);
    if (record) {
      record.finished = true;
      this.pendingRequests.delete(request.requestId);
      
      // 自动解密
      if (this.shouldAutoDecrypt()) {
        this.autoDecrypt(record);
      }
      
      this.updateDisplay();
      this.updateNetworkStats();
    }
  }
  
  generateRequestId() {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }
  
  shouldAutoDecrypt() {
    return this.enableAESDecryptEl && this.enableAESDecryptEl.checked;
  }
  
  autoDecrypt(record) {
    if (typeof autoDetectAndDecrypt === 'function') {
      const decrypted = autoDetectAndDecrypt(record);
      if (decrypted) {
        record.decrypted = decrypted;
        this.updateDisplay();
      }
    }
  }
  
  filterRecords() {
    const filterText = this.filterEl ? this.filterEl.value.toLowerCase() : '';
    const methodFilter = this.methodEl ? this.methodEl.value : '';
    
    this.displayedRecords = this.allRecords.filter(record => {
      const matchesFilter = !filterText || 
        record.request.url.toLowerCase().includes(filterText) ||
        (record.response && record.response.status.toString().includes(filterText));
      
      const matchesMethod = !methodFilter || record.request.method === methodFilter;
      
      return matchesFilter && matchesMethod;
    });
    
    this.updateDisplay();
  }
  
  updateDisplay() {
    if (!this.rowsEl) return;
    
    this.rowsEl.innerHTML = this.displayedRecords.map(record => 
      this.createRequestRow(record)
    ).join('');
  }
  
  createRequestRow(record) {
    const statusClass = record.status === 'success' ? 'success' : 
                       record.status === 'error' ? 'error' : 'pending';
    
    return `
      <div class="request-item" data-id="${record.id}">
        <div class="request-method ${statusClass}">${record.request.method}</div>
        <div class="request-url">${record.request.url}</div>
        <div class="request-status ${statusClass}">${record.response ? record.response.status : 'pending'}</div>
        <div class="request-time">${this.formatTime(record.timestamp)}</div>
        ${record.decrypted ? '<div class="request-decrypted">已解密</div>' : ''}
      </div>
    `;
  }
  
  formatTime(timestamp) {
    if (typeof formatTime === 'function') {
      return formatTime(timestamp);
    }
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else {
      return date.toLocaleTimeString();
    }
  }
  
  updateNetworkStats() {
    this.networkStats.total = this.allRecords.length;
    this.networkStats.success = this.allRecords.filter(r => r.status === 'success').length;
    this.networkStats.error = this.allRecords.filter(r => r.status === 'error').length;
    this.networkStats.pending = this.pendingRequests.size;
    
    // 更新统计显示
    this.updateStatsDisplay();
  }
  
  updateStatsDisplay() {
    const totalEl = document.getElementById('total-requests');
    const successEl = document.getElementById('success-requests');
    const failedEl = document.getElementById('failed-requests');
    
    if (totalEl) totalEl.textContent = this.networkStats.total;
    if (successEl) successEl.textContent = this.networkStats.success;
    if (failedEl) failedEl.textContent = this.networkStats.error;
  }
  
  startRealTimeUpdates() {
    setInterval(() => {
      this.updateNetworkStats();
    }, 1000);
  }
  
  toggleCapture() {
    this.isPaused = !this.isPaused;
    if (this.toggleEl) {
      this.toggleEl.textContent = this.isPaused ? '继续' : '暂停';
    }
  }
  
  clearRecords() {
    this.allRecords = [];
    this.displayedRecords = [];
    this.pendingRequests.clear();
    this.updateDisplay();
    this.updateNetworkStats();
  }
  
  exportRecords() {
    if (typeof exportData === 'function') {
      exportData(this.allRecords, 'network-requests.json');
    }
  }
  
  toggleBodyCapture() {
    // 切换请求体捕获
    console.log('切换请求体捕获');
  }
  
  toggleAESDecrypt() {
    // 切换AES解密
    console.log('切换AES解密');
  }
  
  applyAESDecrypt() {
    // 应用AES解密
    console.log('应用AES解密');
  }
  
  batchDecrypt() {
    // 批量解密
    console.log('批量解密');
  }
  
  toggleSearchHistory() {
    // 切换搜索历史
    console.log('切换搜索历史');
  }
  
  showHelp() {
    // 显示帮助
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      helpModal.style.display = 'block';
    }
  }
  
  setupContextMenu() {
    // 上下文菜单设置
    console.log('设置上下文菜单');
  }
  
  setupKeyboardShortcuts() {
    // 键盘快捷键设置
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            if (this.filterEl) this.filterEl.focus();
            break;
          case 'd':
            e.preventDefault();
            this.batchDecrypt();
            break;
          case 'e':
            e.preventDefault();
            this.exportRecords();
            break;
          case 'l':
            e.preventDefault();
            this.clearRecords();
            break;
        }
      }
    });
  }
}

// 将类暴露到全局作用域
window.NetworkManager = NetworkManager;

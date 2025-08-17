/* 存储管理模块 */

// 存储管理器类
class StorageManager {
  constructor() {
    this.storageList = document.getElementById('storage-list');
    this.storageDetail = document.getElementById('storage-detail');
    
    this.currentStorage = 'localStorage';
    this.isEditing = false;
    this.selectedItem = null;
    
    // 存储编辑器搜索相关
    this.searchMatches = [];
    this.currentMatchIndex = -1;
    this.originalTextareaValue = '';
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.loadStorageData();
    
    // 添加一些示例存储数据用于测试
    this.addSampleStorageData();
  }
  
  addSampleStorageData() {
    // 添加示例存储数据
    const sampleData = [
      {
        key: 'user_preferences',
        value: JSON.stringify({
          theme: 'dark',
          language: 'zh-CN',
          notifications: true
        })
      },
      {
        key: 'session_token',
        value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      },
      {
        key: 'last_visit',
        value: new Date().toISOString()
      }
    ];
    
    this.allItems = sampleData;
    this.displayStorageItems(sampleData);
    
    console.log('已添加示例存储数据:', sampleData);
  }
  
  setupEventListeners() {
    // 存储类型切换
    const localStorageTab = document.querySelector('[data-storage="localStorage"]');
    const sessionStorageTab = document.querySelector('[data-storage="sessionStorage"]');
    
    if (localStorageTab) {
      localStorageTab.addEventListener('click', () => this.switchStorage('localStorage'));
    }
    if (sessionStorageTab) {
      sessionStorageTab.addEventListener('click', () => this.switchStorage('sessionStorage'));
    }
    
    // 存储操作按钮
    const addBtn = document.getElementById('add-storage-item');
    const importBtn = document.getElementById('import-storage');
    const exportBtn = document.getElementById('export-storage');
    const clearBtn = document.getElementById('clear-storage');
    
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addNewStorageItem());
    }
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importStorage());
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportStorage());
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearStorage());
    }
    
    // 添加调试信息
    console.log('存储管理器初始化:', {
      addBtn: !!addBtn,
      importBtn: !!importBtn,
      exportBtn: !!exportBtn,
      clearBtn: !!clearBtn
    });
    
    // 主题切换
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }
  
  async switchStorage(type) {
    this.currentStorage = type;
    
    // 更新标签页状态
    document.querySelectorAll('.storage-tab').forEach(tab => tab.classList.remove('active'));
    const activeTab = document.querySelector(`[data-storage="${type}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
    
    // 重新加载数据
    await this.loadStorageData();
    
    // 清除详情面板
    this.clearStorageDetail();
  }
  
  async loadStorageData() {
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，使用模拟数据');
        // 使用本地存储的数据或空数组
        const localData = this.allItems || [];
        this.displayStorageItems(localData);
        return;
      }
      
      const result = await chrome.devtools.inspectedWindow.eval(`
        (function() {
          const storage = window.${this.currentStorage};
          const items = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            const value = storage.getItem(key);
            items.push({ key, value });
          }
          return items;
        })()
      `);
      
      const items = result[0] || [];
      // 保存到本地
      this.allItems = items;
      this.displayStorageItems(items);
    } catch (error) {
      console.error('加载存储数据失败:', error);
      this.displayStorageItems([]);
    }
  }
  
  displayStorageItems(items) {
    if (!this.storageList) return;
    
    this.storageList.innerHTML = '';
    
    if (items.length === 0) {
      this.storageList.innerHTML = '<div class="storage-item" style="text-align: center; color: var(--muted); padding: 20px;">暂无存储数据</div>';
      return;
    }
    
    items.forEach(item => {
      const itemElement = this.createStorageItemElement(item);
      this.storageList.appendChild(itemElement);
    });
  }
  
  createStorageItemElement(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'storage-item';
    itemDiv.dataset.key = item.key;
    
    const keyDiv = document.createElement('div');
    keyDiv.className = 'storage-key';
    keyDiv.textContent = item.key;
    
    const valueDiv = document.createElement('div');
    valueDiv.className = 'storage-value';
    valueDiv.textContent = this.truncateValue(item.value);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'storage-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => this.editStorageItem(item));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => this.deleteStorageItem(item.key));
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    itemDiv.appendChild(keyDiv);
    itemDiv.appendChild(valueDiv);
    itemDiv.appendChild(actionsDiv);
    
    // 双击编辑
    itemDiv.addEventListener('dblclick', () => this.editStorageItem(item));
    
    return itemDiv;
  }
  
  truncateValue(value) {
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return value;
  }
  
  editStorageItem(item) {
    this.selectedItem = item;
    this.isEditing = true;
    
    this.showStorageEditor(item);
  }
  
  showStorageEditor(item) {
    if (!this.storageDetail) return;
    
    this.storageDetail.innerHTML = `
      <div class="storage-editor">
        <h3>编辑存储项</h3>
        <div class="editor-form">
          <div class="form-group">
            <label>键名:</label>
            <input type="text" id="edit-key" value="${item.key}" readonly>
          </div>
          <div class="form-group">
            <label>值:</label>
            <textarea id="edit-value" rows="10">${item.value}</textarea>
          </div>
          <div class="form-actions">
            <button id="save-storage" class="btn-primary">保存</button>
            <button id="cancel-edit" class="btn-secondary">取消</button>
            <button id="validate-json" class="btn-secondary">验证JSON</button>
          </div>
        </div>
      </div>
    `;
    
    // 绑定事件
    const saveBtn = document.getElementById('save-storage');
    const cancelBtn = document.getElementById('cancel-edit');
    const validateBtn = document.getElementById('validate-json');
    
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveStorageItem());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEdit());
    }
    if (validateBtn) {
      validateBtn.addEventListener('click', () => this.validateJSONValue());
    }
  }
  
  async saveStorageItem() {
    if (!this.selectedItem) return;
    
    const editValue = document.getElementById('edit-value');
    if (!editValue) return;
    
    const newValue = editValue.value;
    
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，无法保存到实际存储');
        // 更新本地数据
        this.selectedItem.value = newValue;
        this.displayStorageItems([this.selectedItem]);
        this.clearStorageDetail();
        this.isEditing = false;
        this.selectedItem = null;
        return;
      }
      
      await chrome.devtools.inspectedWindow.eval(`
        (function() {
          window.${this.currentStorage}.setItem('${this.selectedItem.key}', ${JSON.stringify(newValue)});
          return true;
        })()
      `);
      
      // 更新本地数据
      this.selectedItem.value = newValue;
      
      // 重新加载数据
      await this.loadStorageData();
      
      // 清除编辑器
      this.clearStorageDetail();
      
      this.isEditing = false;
      this.selectedItem = null;
      
      console.log('存储项已保存');
    } catch (error) {
      console.error('保存存储项失败:', error);
    }
  }
  
  cancelEdit() {
    this.isEditing = false;
    this.selectedItem = null;
    this.clearStorageDetail();
  }
  
  async deleteStorageItem(key) {
    if (!confirm(`确定要删除存储项 "${key}" 吗？`)) return;
    
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，无法删除实际存储项');
        // 从本地数据中移除
        const currentItems = this.allItems || [];
        this.allItems = currentItems.filter(item => item.key !== key);
        this.displayStorageItems(this.allItems);
        return;
      }
      
      await chrome.devtools.inspectedWindow.eval(`
        (function() {
          window.${this.currentStorage}.removeItem('${key}');
          return true;
        })()
      `);
      
      // 重新加载数据
      await this.loadStorageData();
      
      console.log('存储项已删除');
    } catch (error) {
      console.error('删除存储项失败:', error);
    }
  }
  
  async addNewStorageItem() {
    const key = prompt('请输入键名:');
    if (!key) return;
    
    const value = prompt('请输入值:');
    if (value === null) return;
    
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，添加到本地数据');
        const newItem = { key, value };
        const currentItems = this.allItems || [];
        this.allItems = [...currentItems, newItem];
        this.displayStorageItems(this.allItems);
        return;
      }
      
      await chrome.devtools.inspectedWindow.eval(`
        (function() {
          window.${this.currentStorage}.setItem('${key}', ${JSON.stringify(value)});
          return true;
        })()
      `);
      
      // 重新加载数据
      await this.loadStorageData();
      
      console.log('存储项已添加');
    } catch (error) {
      console.error('添加存储项失败:', error);
    }
  }
  
  async importStorage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const data = await this.readFileData(file);
        await this.importStorageData(data);
        console.log('存储数据已导入');
      } catch (error) {
        console.error('导入存储数据失败:', error);
      }
    };
    
    input.click();
  }
  
  readFileData(file) {
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
  
  async importStorageData(data) {
    if (!Array.isArray(data)) {
      throw new Error('导入数据格式错误，应为数组格式');
    }
    
    // 检查Chrome DevTools API是否可用
    if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
      console.warn('Chrome DevTools API 不可用，导入到本地数据');
      this.allItems = data;
      this.displayStorageItems(data);
      return;
    }
    
    for (const item of data) {
      if (item.key && item.value !== undefined) {
        await chrome.devtools.inspectedWindow.eval(`
          (function() {
            window.${this.currentStorage}.setItem('${item.key}', ${JSON.stringify(item.value)});
            return true;
          })()
        `);
      }
    }
    
    // 重新加载数据
    await this.loadStorageData();
  }
  
  async exportStorage() {
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，导出本地数据');
        const data = this.allItems || [];
        const filename = `${this.currentStorage}-${Date.now()}.json`;
        
        if (typeof exportData === 'function') {
          exportData(data, filename);
        }
        return;
      }
      
      const result = await chrome.devtools.inspectedWindow.eval(`
        (function() {
          const storage = window.${this.currentStorage};
          const items = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            const value = storage.getItem(key);
            items.push({ key, value });
          }
          return items;
        })()
      `);
      
      const data = result[0] || [];
      const filename = `${this.currentStorage}-${Date.now()}.json`;
      
      if (typeof exportData === 'function') {
        exportData(data, filename);
      }
    } catch (error) {
      console.error('导出存储数据失败:', error);
    }
  }
  
  async clearStorage() {
    if (!confirm(`确定要清空 ${this.currentStorage} 吗？`)) return;
    
    try {
      // 检查Chrome DevTools API是否可用
      if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
        console.warn('Chrome DevTools API 不可用，清空本地数据');
        this.allItems = [];
        this.displayStorageItems([]);
        this.clearStorageDetail();
        return;
      }
      
      await chrome.devtools.inspectedWindow.eval(`
        (function() {
          window.${this.currentStorage}.clear();
          return true;
        })()
      `);
      
      // 重新加载数据
      await this.loadStorageData();
      
      // 清除详情面板
      this.clearStorageDetail();
      
      console.log('存储已清空');
    } catch (error) {
      console.error('清空存储失败:', error);
    }
  }
  
  validateJSONValue() {
    const editValue = document.getElementById('edit-value');
    if (!editValue) return;
    
    const value = editValue.value;
    
    try {
      JSON.parse(value);
      alert('JSON格式正确！');
    } catch (error) {
      alert(`JSON格式错误: ${error.message}`);
    }
  }
  
  clearStorageDetail() {
    if (this.storageDetail) {
      this.storageDetail.innerHTML = `
        <div class="detail-placeholder">
          选择一个存储项查看详情
        </div>
      `;
    }
  }
  
  toggleTheme() {
    if (typeof toggleTheme === 'function') {
      toggleTheme();
    }
  }
}

// 将类暴露到全局作用域
window.StorageManager = StorageManager;

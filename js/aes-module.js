/* AES 解密模块 */

// AES 解密函数
function decryptAES(encryptedData, key, iv = null) {
  try {
    // 这里应该实现真正的AES解密逻辑
    // 目前只是一个占位符实现
    console.log('AES解密:', { encryptedData, key, iv });
    
    // 模拟解密结果
    return {
      success: true,
      decrypted: encryptedData,
      key: key,
      method: 'AES'
    };
  } catch (error) {
    console.error('AES解密失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 批量AES解密
function batchDecryptAES(records, keys) {
  const results = [];
  
  for (const record of records) {
    for (const key of keys) {
      const result = decryptAES(record.data, key);
      if (result.success) {
        results.push({
          record: record,
          decrypted: result.decrypted,
          key: key
        });
        break; // 找到匹配的密钥就停止
      }
    }
  }
  
  return results;
}

// 从sessionStorage获取AES密钥
function getAESKeysFromSessionStorage() {
  try {
    const keys = sessionStorage.getItem('aes-keys');
    return keys ? JSON.parse(keys) : [];
  } catch (error) {
    console.error('获取AES密钥失败:', error);
    return [];
  }
}

// 自动检测并解密
function autoDetectAndDecrypt(record) {
  try {
    // 检测是否为加密数据
    if (!isEncryptedData(record)) {
      return null;
    }
    
    // 获取可用的密钥
    const keys = getAESKeysFromSessionStorage();
    if (keys.length === 0) {
      return null;
    }
    
    // 尝试解密
    for (const key of keys) {
      const result = decryptAES(record.data, key);
      if (result.success) {
        return {
          ...result,
          record: record
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('自动解密失败:', error);
    return null;
  }
}

// 检测是否为加密数据
function isEncryptedData(record) {
  // 简单的加密检测逻辑
  const data = record.data || record.response || record.request;
  
  if (!data) return false;
  
  // 检查是否包含加密标识
  if (typeof data === 'string') {
    return data.includes('encrypted') || 
           data.includes('AES') || 
           data.length > 100; // 假设长字符串可能是加密的
  }
  
  // 检查请求头
  if (record.request && record.request.headers) {
    const headers = record.request.headers;
    return headers['x-encrypted'] || 
           headers['content-encryption'] ||
           headers['x-aes-key'];
  }
  
  return false;
}

// 验证解密结果
function isValidDecryptedContent(content) {
  try {
    // 尝试解析为JSON
    JSON.parse(content);
    return true;
  } catch (e) {
    // 如果不是JSON，检查是否为有效的文本
    return typeof content === 'string' && content.length > 0;
  }
}

// 格式化解密结果
function formatDecryptionResult(result) {
  if (!result || !result.success) {
    return {
      status: 'failed',
      message: result?.error || '解密失败'
    };
  }
  
  return {
    status: 'success',
    decrypted: result.decrypted,
    key: result.key,
    method: result.method || 'AES'
  };
}

// 创建解密状态显示
function createDecryptionStatus(result) {
  const status = formatDecryptionResult(result);
  
  if (status.status === 'success') {
    return `<span class="decrypt-success">✓ 已解密</span>`;
  } else {
    return `<span class="decrypt-failed">✗ ${status.message}</span>`;
  }
}

// AES密钥管理类
class AESKeyManager {
  constructor() {
    this.keys = this.loadKeys();
  }
  
  loadKeys() {
    try {
      const saved = sessionStorage.getItem('aes-keys');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('加载AES密钥失败:', e);
      return [];
    }
  }
  
  saveKeys() {
    try {
      sessionStorage.setItem('aes-keys', JSON.stringify(this.keys));
    } catch (e) {
      console.warn('保存AES密钥失败:', e);
    }
  }
  
  addKey(key, description = '') {
    if (!key || this.keys.some(k => k.key === key)) {
      return false;
    }
    
    this.keys.push({
      key: key,
      description: description,
      added: Date.now()
    });
    
    this.saveKeys();
    return true;
  }
  
  removeKey(key) {
    this.keys = this.keys.filter(k => k.key !== key);
    this.saveKeys();
  }
  
  getKeys() {
    return this.keys;
  }
  
  clearKeys() {
    this.keys = [];
    this.saveKeys();
  }
}

// 将函数暴露到全局作用域
window.decryptAES = decryptAES;
window.batchDecryptAES = batchDecryptAES;
window.getAESKeysFromSessionStorage = getAESKeysFromSessionStorage;
window.autoDetectAndDecrypt = autoDetectAndDecrypt;
window.isValidDecryptedContent = isValidDecryptedContent;
window.formatDecryptionResult = formatDecryptionResult;
window.createDecryptionStatus = createDecryptionStatus;
window.AESKeyManager = AESKeyManager; 
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var BlockCipher = C_lib.BlockCipher;
    var C_algo = C.algo;

    // Lookup tables
    var SBOX = [];
    var INV_SBOX = [];
    var SUB_MIX_0 = [];
    var SUB_MIX_1 = [];
    var SUB_MIX_2 = [];
    var SUB_MIX_3 = [];
    var INV_SUB_MIX_0 = [];
    var INV_SUB_MIX_1 = [];
    var INV_SUB_MIX_2 = [];
    var INV_SUB_MIX_3 = [];

    // Compute lookup tables
    (function () {
        // Compute double table
        var d = [];
        for (var i = 0; i < 256; i++) {
            if (i < 128) {
                d[i] = i << 1;
            } else {
                d[i] = (i << 1) ^ 0x11b;
            }
        }

        // Walk GF(2^8)
        var x = 0;
        var xi = 0;
        for (var i = 0; i < 256; i++) {
            // Compute sbox
            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
            SBOX[x] = sx;
            INV_SBOX[sx] = x;

            // Compute multiplication
            var x2 = d[x];
            var x4 = d[x2];
            var x8 = d[x4];

            // Compute sub bytes, mix columns tables
            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
            SUB_MIX_3[x] = t;

            // Compute inv sub bytes, inv mix columns tables
            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
            INV_SUB_MIX_3[sx] = t;

            // Compute next counter
            if (!x) {
                x = xi = 1;
            } else {
                x = x2 ^ d[d[d[x8 ^ x2]]];
                xi ^= d[d[xi]];
            }
        }
    }());

    // Precomputed Rcon lookup
    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

    /**
     * AES block cipher algorithm.
     */
    var AES = C_algo.AES = BlockCipher.extend({
        _doReset: function () {
            var t;
            
            // Skip reset of nRounds has been set before and key did not change
            if (this._nRounds && this._keyPriorReset === this._key) {
                return;
            }

            // Shortcuts
            var key = this._keyPriorReset = this._key;
            var keyWords = key.words;
            var keySize = key.sigBytes / 4;

            // Compute number of rounds
            var nRounds = this._nRounds = keySize + 6;

            // Compute number of key schedule rows
            var ksRows = (nRounds + 1) * 4;

            // Compute key schedule
            var keySchedule = this._keySchedule = [];
            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
                if (ksRow < keySize) {
                    keySchedule[ksRow] = keyWords[ksRow];
                } else {
                    t = keySchedule[ksRow - 1];

                    if (!(ksRow % keySize)) {
                        // Rot word
                        t = (t << 8) | (t >>> 24);

                        // Sub word
                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

                        // Mix Rcon
                        t ^= RCON[(ksRow / keySize) | 0] << 24;
                    } else if (keySize > 6 && ksRow % keySize == 4) {
                        // Sub word
                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
                    }

                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
                }
            }

            // Compute inv key schedule
            var invKeySchedule = this._invKeySchedule = [];
            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
                var ksRow = ksRows - invKsRow;

                if (invKsRow % 4) {
                    var t = keySchedule[ksRow];
                } else {
                    var t = keySchedule[ksRow - 4];
                }

                if (invKsRow < 4 || ksRow <= 4) {
                    invKeySchedule[invKsRow] = t;
                } else {
                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
                }
            }
        },

        encryptBlock: function (M, offset) {
            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
        },

        decryptBlock: function (M, offset) {
            // Swap 2nd and 4th rows
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;

            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

            // Inv swap 2nd and 4th rows
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;
        },

        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
            // Shortcut
            var nRounds = this._nRounds;

            // Get input, add round key
            var s0 = M[offset]     ^ keySchedule[0];
            var s1 = M[offset + 1] ^ keySchedule[1];
            var s2 = M[offset + 2] ^ keySchedule[2];
            var s3 = M[offset + 3] ^ keySchedule[3];

            // Key schedule row counter
            var ksRow = 4;

            // Rounds
            for (var round = 1; round < nRounds; round++) {
                // Shift rows, sub bytes, mix columns, add round key
                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

                // Update state
                s0 = t0;
                s1 = t1;
                s2 = t2;
                s3 = t3;
            }

            // Shift rows, sub bytes, add round key
            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

            // Set output
            M[offset]     = t0;
            M[offset + 1] = t1;
            M[offset + 2] = t2;
            M[offset + 3] = t3;
        },

        keySize: 256/32
    });

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
     */
    C.AES = BlockCipher._createHelper(AES);
}());

/* AES解密模块 */

// AES解密函数
export async function decryptAES(encryptedText, key) {
  try {
    if (!encryptedText || !key) {
      throw new Error('加密文本和密钥不能为空');
    }

    // 尝试使用CryptoJS解密
    if (typeof CryptoJS !== 'undefined') {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        throw new Error('解密失败，可能是密钥错误');
      }
      
      return result;
    } else {
      throw new Error('CryptoJS库未加载');
    }
  } catch (error) {
    console.error('AES解密失败:', error);
    throw error;
  }
}

// 批量AES解密
export async function batchDecryptAES(records, key) {
  const results = [];
  const errors = [];
  
  for (const record of records) {
    try {
      if (record.request && record.request.postData && record.request.postData.text) {
        const decrypted = await decryptAES(record.request.postData.text, key);
        results.push({
          id: record.id,
          type: 'request',
          original: record.request.postData.text,
          decrypted: decrypted
        });
      }
      
      if (record.response && record.response.content && record.response.content.text) {
        const decrypted = await decryptAES(record.response.content.text, key);
        results.push({
          id: record.id,
          type: 'response',
          original: record.response.content.text,
          decrypted: decrypted
        });
      }
    } catch (error) {
      errors.push({
        id: record.id,
        error: error.message
      });
    }
  }
  
  return { results, errors };
}

// 从sessionStorage获取AES密钥
export async function getAESKeysFromSessionStorage() {
  try {
    const result = await chrome.devtools.inspectedWindow.eval(`
      (function() {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          const value = sessionStorage.getItem(key);
          if (key.toLowerCase().includes('aes') || 
              key.toLowerCase().includes('key') || 
              key.toLowerCase().includes('secret') ||
              value.length === 32 || value.length === 64) {
            keys.push({ key, value });
          }
        }
        return keys;
      })()
    `);
    
    return result[0] || [];
  } catch (error) {
    console.error('获取sessionStorage密钥失败:', error);
    return [];
  }
}

// 自动检测并解密AES内容
export async function autoDetectAndDecrypt(text, keys) {
  if (!text || !keys || keys.length === 0) {
    return { decrypted: text, key: null, isEncrypted: false };
  }
  
  // 尝试每个密钥
  for (const keyObj of keys) {
    try {
      const decrypted = await decryptAES(text, keyObj.value);
      
      // 检查解密结果是否看起来像有效内容
      if (isValidDecryptedContent(decrypted)) {
        return {
          decrypted: decrypted,
          key: keyObj.key,
          isEncrypted: true
        };
      }
    } catch (error) {
      // 继续尝试下一个密钥
      continue;
    }
  }
  
  return { decrypted: text, key: null, isEncrypted: false };
}

// 验证解密后的内容是否有效
function isValidDecryptedContent(text) {
  if (!text || text.length < 10) return false;
  
  // 检查是否包含常见的JSON结构
  if (text.includes('{') && text.includes('}')) {
    try {
      JSON.parse(text);
      return true;
    } catch (e) {
      // 不是有效的JSON，但可能仍然是有效内容
    }
  }
  
  // 检查是否包含常见的HTML标签
  if (text.includes('<') && text.includes('>')) {
    return true;
  }
  
  // 检查是否包含常见的数据格式标识
  const dataPatterns = [
    /^[a-zA-Z0-9+/=]+$/, // Base64
    /^[0-9a-fA-F]+$/,    // Hex
    /^[a-zA-Z0-9\-_\.]+$/, // 普通文本
  ];
  
  return dataPatterns.some(pattern => pattern.test(text));
}

// 格式化解密结果
export function formatDecryptionResult(result) {
  if (!result.isEncrypted) {
    return {
      text: result.decrypted,
      status: 'not_encrypted',
      message: '内容未加密'
    };
  }
  
  return {
    text: result.decrypted,
    status: 'success',
    message: `使用密钥 "${result.key}" 解密成功`,
    key: result.key
  };
}

// 创建解密状态指示器
export function createDecryptionStatus(status) {
  const indicator = document.createElement('span');
  indicator.className = 'decryption-status';
  
  switch (status) {
    case 'success':
      indicator.textContent = '✓';
      indicator.style.color = 'var(--success)';
      break;
    case 'error':
      indicator.textContent = '✗';
      indicator.style.color = 'var(--danger)';
      break;
    case 'not_encrypted':
      indicator.textContent = '−';
      indicator.style.color = 'var(--muted)';
      break;
    default:
      indicator.textContent = '?';
      indicator.style.color = 'var(--warning)';
  }
  
  return indicator;
}

// AES密钥管理
export class AESKeyManager {
  constructor() {
    this.keys = [];
    this.loadKeys();
  }
  
  async loadKeys() {
    this.keys = await getAESKeysFromSessionStorage();
  }
  
  async refreshKeys() {
    await this.loadKeys();
  }
  
  getKeys() {
    return this.keys;
  }
  
  addKey(key, value) {
    this.keys.push({ key, value });
  }
  
  removeKey(key) {
    this.keys = this.keys.filter(k => k.key !== key);
  }
  
  hasKeys() {
    return this.keys.length > 0;
  }
  
  // 获取密钥列表用于显示
  getKeyList() {
    return this.keys.map(k => ({
      label: `${k.key} (${k.value.length} chars)`,
      value: k.key,
      key: k.key,
      preview: k.value.substring(0, 8) + '...'
    }));
  }
}

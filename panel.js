/* global chrome */
(function () {
  const rowsEl = document.getElementById('rows');
  const tableEl = document.getElementById('table');
  const paneEl = document.getElementById('pane');
  const filterEl = document.getElementById('filter');
  const suffixFilterEl = document.getElementById('suffix-filter');
  const suffixModeEl = document.getElementById('suffix-mode');
  const methodEl = document.getElementById('method');
  const toggleEl = document.getElementById('toggle');
  const clearEl = document.getElementById('clear');
  const exportEl = document.getElementById('export');
  const captureBodiesEl = document.getElementById('captureBodies');
  // 创建虚拟元素以避免错误
  const enableDecryptEl = { checked: false };
  const decryptFnEl = { value: '' };
  const applyDecryptEl = { addEventListener: () => {} };
  const enableAESDecryptEl = document.getElementById('enableAESDecrypt');
  const applyAESDecryptEl = document.getElementById('applyAESDecrypt');

  let isPaused = false;
  let allRecords = [];
  let displayedRecords = [];
  let selectedId = null;
  const pendingByKey = new Map();
  
  // 新的请求管理系统
  const pendingRequests = new Map(); // 存储待完成的请求
  let requestCounter = 0;

  function formatBytes(bytes) {
    if (bytes == null) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  function classifyStatus(status) {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'warning';
    return 'error';
  }

  function applyFilter() {
    const text = filterEl.value.trim().toLowerCase();
    const method = methodEl.value;
    const suffixes = suffixFilterEl.value.trim().toLowerCase().split(',').filter(s => s);
    const suffixMode = suffixModeEl.value; // 'include' 或 'exclude'
    
    displayedRecords = allRecords.filter((r) => {
      // 方法过滤
      if (method && r.request.method !== method) return false;
      
      // 后缀过滤
      if (suffixes.length > 0) {
        const url = r.request.url.toLowerCase();
        
        // 检查URL是否匹配任一后缀
        const hasSuffix = suffixes.some(suffix => {
          const cleanSuffix = suffix.trim();
          if (!cleanSuffix) return false;
          return url.endsWith(cleanSuffix) || url.includes(cleanSuffix + '?');
        });
        
        // 根据模式决定是包含还是排除
        if (suffixMode === 'include' && !hasSuffix) return false;
        if (suffixMode === 'exclude' && hasSuffix) return false;
      }
      
      // 文本过滤
      if (!text) return true;
      const hay = [
        r.request.url,
        r.request.method,
        String(r.response?.status || ''),
        r.initiator?.type || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(text);
    });
    
    renderTable();
  }

  function renderTable() {
    rowsEl.innerHTML = '';
    displayedRecords.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = rec.id;
      if (rec.id === selectedId) tr.classList.add('active');
      
      // 如果请求还未完成，添加特殊样式
      if (rec.isEarlyCapture && !rec.isCompleted) {
        tr.classList.add('pending-request');
      }
      
      const timeMs = rec.timing?.receiveHeadersEnd != null && rec.timing?.requestTime != null
        ? Math.max(0, Math.round(rec.timing.receiveHeadersEnd))
        : rec.durationMs != null ? Math.round(rec.durationMs) : '';
      const size = rec.encodedDataLength ?? rec.response?.headersText?.length ?? rec.response?.body?.length;
      
      // 状态显示逻辑
      let statusContent = '';
      if (rec.isEarlyCapture && !rec.isCompleted) {
        statusContent = '<span class="status-badge pending">⏳ Pending</span>';
      } else {
        const status = rec.response?.status;
        statusContent = `<span class="status-badge ${classifyStatus(status || 0)}">${status ?? ''}</span>`;
      }
      
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><span class="method-tag ${rec.request.method.toLowerCase()}">${rec.request.method}</span></td>
        <td title="${rec.request.url}" class="url-cell">${rec.request.url}</td>
        <td>${statusContent}</td>
        <td>${rec.initiator?.type || ''}</td>
        <td class="tooltip" data-tooltip="响应时间">${timeMs || (rec.isEarlyCapture && !rec.isCompleted ? '⏳' : '')}</td>
        <td class="tooltip" data-tooltip="数据大小">${size != null ? formatBytes(size) : (rec.isEarlyCapture && !rec.isCompleted ? '⏳' : '')}</td>
      `;
      tr.addEventListener('click', () => selectRecord(rec.id));
      rowsEl.appendChild(tr);
    });
  }

  function selectRecord(id) {
    selectedId = id;
    const rec = allRecords.find((r) => r.id === id);
    if (!rec) return;
    Array.from(rowsEl.children).forEach((tr) => {
      tr.classList.toggle('active', tr.dataset.id === String(id));
    });
    renderDetails(rec);
  }

  function renderDetails(rec) {
    const tabs = document.querySelectorAll('.tabs button');
    tabs.forEach((b) => b.classList.remove('active'));
    const show = (name, contentHtml) => {
      paneEl.innerHTML = contentHtml;
      const btn = Array.from(tabs).find((b) => b.dataset.tab === name);
      if (btn) btn.classList.add('active');
    };

    function code(obj, id = null, isAESDecrypted = false) {
      if (obj == null) return '<pre>(empty)</pre>';
      let text = '';
      let detectedLanguage = null;
      
      if (typeof obj === 'string') {
        text = obj;
        detectedLanguage = detectLanguage(text);
      } else if (obj instanceof ArrayBuffer) {
        text = `[binary] ${obj.byteLength} bytes`;
      } else {
        try { 
          text = JSON.stringify(obj, null, 2); 
          detectedLanguage = 'json';
        } catch (e) { 
          text = String(obj); 
        }
      }
      
      // 添加复制按钮（如果提供了ID）
      let copyBtn = '';
      if (id) {
        const copyId = `copy-${id}`;
        copyBtn = `<button class="copy-btn" data-target="${copyId}" title="复制到剪贴板">📋 复制</button>`;
      }
      
      // 如果是AES解密内容并且检测到语言，使用语法高亮
      if (isAESDecrypted && detectedLanguage && typeof hljs !== 'undefined') {
        try {
          // 检查语言是否被支持
          if (hljs.getLanguage && hljs.getLanguage(detectedLanguage)) {
            const highlightedCode = hljs.highlight(text, { language: detectedLanguage }).value;
            return `<div class="code-container">${copyBtn}<pre id="${id || ''}" class="hljs language-${detectedLanguage}">${highlightedCode}</pre></div>`;
          } else {
            console.warn(`语言 ${detectedLanguage} 不被支持，使用自动检测`);
            const result = hljs.highlightAuto(text);
            return `<div class="code-container">${copyBtn}<pre id="${id || ''}" class="hljs">${result.value}</pre></div>`;
          }
        } catch (e) {
          console.warn('语法高亮失败:', e);
        }
      }
      
      return `<div class="code-container">${copyBtn}<pre id="${id || ''}">${escapeHtml(text)}</pre></div>`;
    }
    
    // 创建可折叠组件
    function createCollapsibleSection(title, content, type = 'original', defaultExpanded = true) {
      const sectionId = `section-${Math.random().toString(36).slice(2)}`;
      const expandedClass = defaultExpanded ? '' : 'collapsed';
      const toggleSymbol = defaultExpanded ? '▼' : '▶';
      
      return `
        <div class="collapsible-section">
          <div class="collapsible-header" data-section-id="${sectionId}">
            <span class="collapsible-toggle ${expandedClass}" id="toggle-${sectionId}">${toggleSymbol}</span>
            <h4 class="collapsible-title ${type}">${title}</h4>
          </div>
          <div class="collapsible-content ${expandedClass}" id="content-${sectionId}">
            ${content}
          </div>
        </div>
      `;
    }
    
    // 检测文本的语言类型
    function detectLanguage(text) {
      const trimmed = text.trim();
      
      // JSON检测
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          JSON.parse(trimmed);
          return 'json';
        } catch (e) {
          // 可能是JavaScript对象语法
          if (trimmed.includes(':') && !trimmed.includes('=')) {
            return 'javascript';
          }
        }
      }
      
      // XML/HTML检测
      if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        return 'xml';
      }
      
      // JavaScript检测
      if (trimmed.includes('function') || trimmed.includes('=>') || 
          trimmed.includes('var ') || trimmed.includes('let ') || 
          trimmed.includes('const ')) {
        return 'javascript';
      }
      
      return null;
    }

    function headersToHtml(headersObj, headersText, id = null) {
      let content = '';
      if (headersText) {
        content = `<pre>${escapeHtml(headersText)}</pre>`;
      } else if (!headersObj) {
        return '<pre>(none)</pre>';
      } else {
        const lines = Object.entries(headersObj).map(([k, v]) => `${k}: ${v}`).join('\n');
        content = `<pre>${escapeHtml(lines)}</pre>`;
      }
      
      // 添加复制按钮（如果提供了ID）
      if (id) {
        const copyId = `copy-${id}`;
        const copyBtn = `<button class="copy-btn" data-target="${copyId}" title="复制到剪贴板">📋 复制</button>`;
        return `<div class="code-container">${copyBtn}<pre id="${id}">${content}</pre></div>`;
      }
      
      return content;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    // Wire tabs
    document.querySelectorAll('.tabs button').forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        if (tab === 'overview') {
          show('overview', `
            <div style="padding:10px">
              <div><b>Method</b>: ${rec.request.method}</div>
              <div><b>URL</b>: ${escapeHtml(rec.request.url)}</div>
              <div><b>Status</b>: ${rec.response?.status ?? ''}</div>
              <div><b>Type</b>: ${rec.initiator?.type || ''}</div>
              <div><b>Time</b>: ${rec.durationMs != null ? Math.round(rec.durationMs) + ' ms' : ''}</div>
              <div><b>Transferred</b>: ${rec.encodedDataLength != null ? formatBytes(rec.encodedDataLength) : ''}</div>
            </div>
          `);
        } else if (tab === 'request') {
          let requestContent = `<div style="padding:10px">`;
          
          // 添加全局控制按钮
          requestContent += `
            <div style="margin-bottom: 10px; text-align: right;">
              <button class="expand-all-btn" data-action="expand" style="background: var(--success); color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px; cursor: pointer; font-size: 11px;">全部展开</button>
              <button class="collapse-all-btn" data-action="collapse" style="background: var(--muted); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">全部收起</button>
            </div>
          `;
          
          // AES解密的请求体 - 优先显示，默认展开
          if (rec.request.aesDecryptedBody) {
            const content = code(rec.request.aesDecryptedBody, 'req-aes-body', true);
            requestContent += createCollapsibleSection('🔓 AES Decrypted Body', content, 'aes-decrypted', true);
          }
          
          // AES解密的plainBody - 优先显示，默认展开
          if (rec.request.aesDecryptedPlainBody) {
            const content = code(rec.request.aesDecryptedPlainBody, 'req-aes-plain', true);
            requestContent += createCollapsibleSection('🔓 AES Decrypted Plain Body', content, 'aes-decrypted', true);
          }
          
          // 函数解密体 - 默认展开
          if (rec.request.decryptedBody) {
            const content = code(rec.request.decryptedBody, 'req-fn-body');
            requestContent += createCollapsibleSection('⚙️ Function Decrypted Body', content, 'function-decrypted', true);
          }
          
          // 原始请求体 - 默认收起
          const origBodyContent = code(rec.request.body, 'req-orig-body');
          requestContent += createCollapsibleSection('📄 Original Request Body', origBodyContent, 'original', false);
          
          // 原始plainBody - 默认收起
          if (rec.request.plainBody) {
            const plainBodyContent = code(rec.request.plainBody, 'req-orig-plain');
            requestContent += createCollapsibleSection('📋 Original Plain Body', plainBodyContent, 'original', false);
          }
          
          requestContent += `</div>`;
          show('request', requestContent);
        } else if (tab === 'response') {
          let responseContent = `<div style="padding:10px">`;
          
          // 添加全局控制按钮
          responseContent += `
            <div style="margin-bottom: 10px; text-align: right;">
              <button class="expand-all-btn" data-action="expand" style="background: var(--success); color: white; border: none; padding: 4px 8px; border-radius: 4px; margin-right: 5px; cursor: pointer; font-size: 11px;">全部展开</button>
              <button class="collapse-all-btn" data-action="collapse" style="background: var(--muted); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">全部收起</button>
            </div>
          `;
          
          // AES解密的响应体 - 优先显示，默认展开
          if (rec.response?.aesDecryptedBody) {
            const content = code(rec.response.aesDecryptedBody, 'resp-aes-body', true);
            responseContent += createCollapsibleSection('🔓 AES Decrypted Body', content, 'aes-decrypted', true);
          }
          
          // AES解密的plainBody - 优先显示，默认展开
          if (rec.response?.aesDecryptedPlainBody) {
            const content = code(rec.response.aesDecryptedPlainBody, 'resp-aes-plain', true);
            responseContent += createCollapsibleSection('🔓 AES Decrypted Plain Body', content, 'aes-decrypted', true);
          }
          
          // 函数解密体 - 默认展开
          if (rec.response?.decryptedBody) {
            const content = code(rec.response.decryptedBody, 'resp-fn-body');
            responseContent += createCollapsibleSection('⚙️ Function Decrypted Body', content, 'function-decrypted', true);
          }
          
          // 原始响应体 - 默认收起
          const origRespContent = code(rec.response?.body, 'resp-orig-body');
          responseContent += createCollapsibleSection('📄 Original Response Body', origRespContent, 'original', false);
          
          // 原始plainBody - 默认收起
          if (rec.response?.plainBody) {
            const plainRespContent = code(rec.response.plainBody, 'resp-orig-plain');
            responseContent += createCollapsibleSection('📋 Original Plain Body', plainRespContent, 'original', false);
          }
          
          responseContent += `</div>`;
          show('response', responseContent);
        } else if (tab === 'headers') {
          show('headers', `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">
              <div>
                <h4>Request Headers</h4>
                ${headersToHtml(rec.request.headers, rec.request.headersText, 'req-headers')}
              </div>
              <div>
                <h4>Response Headers</h4>
                ${headersToHtml(rec.response?.headers, rec.response?.headersText, 'resp-headers')}
              </div>
            </div>
          `);
        } else if (tab === 'timing') {
          const t = rec.timing || {};
          show('timing', `
            <div style="padding:10px">
              ${code(t)}
            </div>
          `);
        }
      };
    });

    // Default tab
    const defaultBtn = document.querySelector('.tabs button[data-tab="overview"]');
    if (defaultBtn) defaultBtn.click();
    
    // 设置折叠功能的事件委托
    setupCollapsibleEvents();
  }
  
  // 折叠切换函数
  function toggleCollapsible(sectionId) {
    const toggle = document.getElementById(`toggle-${sectionId}`);
    const content = document.getElementById(`content-${sectionId}`);
    
    if (toggle && content) {
      const isCollapsed = content.classList.contains('collapsed');
      
      if (isCollapsed) {
        // 展开
        content.classList.remove('collapsed');
        toggle.classList.remove('collapsed');
        toggle.textContent = '▼';
      } else {
        // 收起
        content.classList.add('collapsed');
        toggle.classList.add('collapsed');
        toggle.textContent = '▶';
      }
    }
  }
  
  // 展开/收起所有内容
  function toggleAllCollapsibles(expand = null) {
    const allToggles = paneEl.querySelectorAll('.collapsible-toggle');
    const allContents = paneEl.querySelectorAll('.collapsible-content');
    
    // 如果没有指定expand参数，根据第一个元素的状态决定
    if (expand === null) {
      const firstContent = allContents[0];
      expand = firstContent ? firstContent.classList.contains('collapsed') : true;
    }
    
    allToggles.forEach(toggle => {
      if (expand) {
        toggle.classList.remove('collapsed');
        toggle.textContent = '▼';
      } else {
        toggle.classList.add('collapsed');
        toggle.textContent = '▶';
      }
    });
    
    allContents.forEach(content => {
      if (expand) {
        content.classList.remove('collapsed');
      } else {
        content.classList.add('collapsed');
      }
    });
  }
  
  // 处理折叠点击事件
  function handleCollapsibleClick(e) {
    console.log('折叠点击事件触发:', e.target);
    
    // 处理折叠头部点击
    const header = e.target.closest('.collapsible-header');
    if (header) {
      const sectionId = header.getAttribute('data-section-id');
      console.log('点击折叠头部，sectionId:', sectionId);
      if (sectionId) {
        toggleCollapsible(sectionId);
        return;
      }
    }
    
    // 处理全局控制按钮
    if (e.target.classList.contains('expand-all-btn')) {
      console.log('点击全部展开按钮');
      toggleAllCollapsibles(true);
      return;
    }
    
    if (e.target.classList.contains('collapse-all-btn')) {
      console.log('点击全部收起按钮');
      toggleAllCollapsibles(false);
      return;
    }
  }
  
  // 设置可折叠组件的事件处理
  function setupCollapsibleEvents() {
    // 移除之前的事件监听器以避免重复绑定
    paneEl.removeEventListener('click', handleCollapsibleClick);
    
    // 添加事件委托
    paneEl.addEventListener('click', handleCollapsibleClick);
    
    console.log('折叠功能事件已绑定');
  }

  function onNewRecord(rec) {
    allRecords.push(rec);
    tryAttachPlainBodies(rec);
    if (!isPaused) {
      applyFilter();
      if (displayedRecords.length === 1) {
        selectRecord(rec.id);
      }
    }
  }

  function wireToolbar() {
    filterEl.addEventListener('input', applyFilter);
    suffixFilterEl.addEventListener('input', applyFilter);
    suffixModeEl.addEventListener('change', applyFilter);
    methodEl.addEventListener('change', applyFilter);
    toggleEl.addEventListener('click', () => {
      isPaused = !isPaused;
      toggleEl.textContent = isPaused ? 'Resume' : 'Pause';
      if (!isPaused) applyFilter();
    });
    clearEl.addEventListener('click', () => {
      allRecords = [];
      displayedRecords = [];
      rowsEl.innerHTML = '';
      paneEl.innerHTML = '';
      selectedId = null;
    });
    exportEl.addEventListener('click', () => {
      const data = JSON.stringify(allRecords, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'network-console.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // 原始解密功能已被移除
    /* applyDecryptEl.addEventListener('click', () => {
      // Re-try decrypt on already captured records
      if (!enableDecryptEl.checked) return;
      const fnName = decryptFnEl.value.trim();
      if (!fnName) return;
      // allRecords.forEach((r) => tryDecryptBodies(r, fnName));
      if (selectedId) selectRecord(selectedId);
    }); */

    applyAESDecryptEl.addEventListener('click', async () => {
      // AES解密处理
      if (!enableAESDecryptEl.checked) return;
      
      const keys = await getAESKeys();
      if (!keys || !keys.key) {
        alert('无法从sessionStorage.securityObject获取AES密钥');
        return;
      }

      console.log('获取到AES密钥:', {
        key: keys.key ? `${keys.key.substring(0, 8)}...` : 'null',
        keyLength: keys.key ? keys.key.length : 0,
        iv: keys.iv ? `${keys.iv.substring(0, 8)}...` : 'null',
        ivLength: keys.iv ? keys.iv.length : 0
      });
      
      // 验证密钥格式
      if (keys.key && keys.key.length !== 32) {
        console.warn('AES密钥长度警告: 期望32个字符，实际', keys.key.length, '个字符');
      }
      if (keys.iv && keys.iv.length !== 16) {
        console.warn('AES IV长度警告: 期望16个字符，实际', keys.iv.length, '个字符');
      }
      
      allRecords.forEach((r) => tryAESDecryptBodies(r, keys.key, keys.iv));
      if (selectedId) selectRecord(selectedId);
    });
  }

  function subscribeToNetwork() {
    // 监听请求完成事件（用于合并响应数据）
    chrome.devtools.network.onRequestFinished.addListener(async function (request) {
      if (isPaused) return;
      await handleRequestFinished(request);
    });
    
    // 使用增强的页面监听来捕获请求开始
    startEarlyRequestCapture();
  }
  
  // 处理请求完成事件
  async function handleRequestFinished(request) {
    const requestKey = generateRequestKey(request.request.method, request.request.url);
    let rec = pendingRequests.get(requestKey);
    
    if (!rec) {
      // 如果没有找到对应的请求记录，创建一个新的
      rec = createRequestRecord(request);
      rec.isLateCapture = true; // 标记为延迟捕获
    } else {
      // 从待处理列表中移除
      pendingRequests.delete(requestKey);
    }
    
    // 更新响应信息
    rec.response = {
      status: request.response.status,
      statusText: request.response.statusText,
      headers: request.response.headers?.reduce((acc, h) => (acc[h.name] = h.value, acc), {}) || {},
      headersText: request.responseHeadersText || undefined,
      body: undefined,
    };
    
    // 更新其他完成信息
    rec.durationMs = request.time;
    rec.encodedDataLength = request.encodedDataLength;
    rec.timing = request.timing;
    rec.isCompleted = true;
    
    try {
      // 获取响应体
      if (captureBodiesEl.checked) {
        await new Promise((resolve) => request.getContent((content, encoding) => {
          if (content != null && content !== '') {
            if (encoding === 'base64') {
              rec.response.body = `[base64] ${content.length} chars`;
            } else {
              rec.response.body = tryParseJson(content);
            }
          }
          resolve();
        }));
      }
    } catch (_) {}
    
    // 如果是新记录，添加到列表中
    if (rec.isLateCapture || !allRecords.includes(rec)) {
      onNewRecord(rec);
    } else {
      // 如果是已存在的记录，更新显示
      updateRecordDisplay(rec);
    }
    
    // 自动尝试AES解密（如果启用）
    if (enableAESDecryptEl.checked) {
      getAESKeys().then(keys => {
        if (keys && keys.key) {
          tryAESDecryptBodies(rec, keys.key, keys.iv);
          // 如果当前选中的是这个记录，刷新显示
          if (selectedId === rec.id) {
            selectRecord(rec.id);
          }
        }
      });
    }
  }
  
  // 创建请求记录
  function createRequestRecord(request, isEarlyCapture = false) {
    const id = `${Date.now()}-${++requestCounter}-${Math.random().toString(36).slice(2)}`;
    const rec = {
      id,
      startedDateTime: request.startedDateTime || new Date().toISOString(),
      durationMs: isEarlyCapture ? null : request.time,
      encodedDataLength: isEarlyCapture ? null : request.encodedDataLength,
      initiator: request.initiator || { type: 'unknown' },
      request: {
        method: request.request.method,
        url: request.request.url,
        headers: request.request.headers?.reduce((acc, h) => (acc[h.name] = h.value, acc), {}) || {},
        headersText: request.requestHeadersText || undefined,
        body: undefined,
      },
      response: isEarlyCapture ? {
        status: null,
        statusText: 'Pending...',
        headers: {},
        headersText: undefined,
        body: undefined,
      } : null,
      timing: isEarlyCapture ? null : request.timing,
      isEarlyCapture,
      isCompleted: !isEarlyCapture,
    };
    
    // 获取请求体
    try {
      if (captureBodiesEl.checked) {
        const postData = request.request?.postData?.text;
        if (postData != null) {
          rec.request.body = tryParseJson(postData);
        }
      }
    } catch (_) {}
    
    return rec;
  }
  
  // 生成请求键
  function generateRequestKey(method, url) {
    return `${method.toUpperCase()} ${url}`;
  }
  
  // 开始早期请求捕获
  function startEarlyRequestCapture() {
    // 增强页面监听器，捕获请求开始事件
    const enhancedCode = `(function(){
      if (window.__NC_EARLY_CAPTURE__) return;
      window.__NC_EARLY_CAPTURE__ = true;
      
      // 存储早期请求事件
      window.__NC_EARLY_REQUESTS__ = [];
      
      function pushEarlyRequest(evt) {
        try {
          evt.timestamp = Date.now();
          window.__NC_EARLY_REQUESTS__.push(evt);
          // 限制数组大小，防止内存泄漏
          if (window.__NC_EARLY_REQUESTS__.length > 1000) {
            window.__NC_EARLY_REQUESTS__.splice(0, 500);
          }
        } catch(e) {}
      }
      
      // 增强现有的拦截器，添加请求开始事件
      const originalAxiosReqUse = window.axios && window.axios.interceptors && window.axios.interceptors.request.use;
      if (originalAxiosReqUse) {
        window.axios.interceptors.request.use(function(config) {
          const url = (config.baseURL || '') + (config.url || '');
          const method = String(config.method || 'GET').toUpperCase();
          pushEarlyRequest({
            type: 'request-start',
            method,
            url,
            headers: config.headers || {},
            body: config.data,
            source: 'axios'
          });
          return config;
        });
      }
      
      // 增强fetch拦截
      const originalFetch = window.fetch;
      if (originalFetch && !originalFetch.__nc_early_patched) {
        window.fetch = function(input, init) {
          const url = (typeof input === 'string' ? input : (input && input.url)) || '';
          const method = (init && init.method) || (input && input.method) || 'GET';
          const headers = (init && init.headers) || (input && input.headers) || {};
          const body = init && init.body;
          
          pushEarlyRequest({
            type: 'request-start',
            method: method.toUpperCase(),
            url,
            headers,
            body,
            source: 'fetch'
          });
          
          return originalFetch.apply(this, arguments);
        };
        window.fetch.__nc_early_patched = true;
      }
      
      // 增强XHR拦截
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__nc_method = method;
        this.__nc_url = url;
        this.__nc_headers = {};
        return originalXHROpen.apply(this, arguments);
      };
      
      const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        this.__nc_headers = this.__nc_headers || {};
        this.__nc_headers[name] = value;
        return originalSetRequestHeader.apply(this, arguments);
      };
      
      XMLHttpRequest.prototype.send = function(body) {
        const method = (this.__nc_method || 'GET').toUpperCase();
        const url = this.__nc_url || '';
        const headers = this.__nc_headers || {};
        
        pushEarlyRequest({
          type: 'request-start',
          method,
          url,
          headers,
          body,
          source: 'xhr'
        });
        
        return originalXHRSend.apply(this, arguments);
      };
      
      return true;
    })();`;
    
    chrome.devtools.inspectedWindow.eval(enhancedCode, function() {
      console.log('早期请求捕获已启用');
    });
    
    // 开始轮询早期请求事件
    startPollingEarlyRequests();
  }
  
  // 轮询早期请求事件
  function startPollingEarlyRequests() {
    setInterval(() => {
      chrome.devtools.inspectedWindow.eval(`
        (function() {
          const events = window.__NC_EARLY_REQUESTS__ || [];
          window.__NC_EARLY_REQUESTS__ = [];
          return events;
        })()
      `, (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        processEarlyRequests(events);
      });
    }, 200); // 更频繁的轮询，200ms
  }
  
  // 处理早期请求事件
  function processEarlyRequests(events) {
    if (isPaused) return;
    
    for (const event of events) {
      if (event.type === 'request-start') {
        const requestKey = generateRequestKey(event.method, event.url);
        
        // 检查是否已存在
        if (!pendingRequests.has(requestKey)) {
          // 创建早期捕获的请求记录
          const mockRequest = {
            startedDateTime: new Date(event.timestamp).toISOString(),
            initiator: { type: event.source || 'script' },
            request: {
              method: event.method,
              url: event.url,
              headers: event.headers ? Object.entries(event.headers).map(([name, value]) => ({name, value})) : [],
              postData: event.body ? { text: typeof event.body === 'string' ? event.body : JSON.stringify(event.body) } : undefined
            }
          };
          
          const rec = createRequestRecord(mockRequest, true);
          pendingRequests.set(requestKey, rec);
          
          // 立即显示这个请求
          onNewRecord(rec);
          
          console.log(`早期捕获请求: ${event.method} ${event.url}`);
        }
      }
    }
  }
  
  // 更新记录显示
  function updateRecordDisplay(rec) {
    // 重新应用过滤器以更新显示
    applyFilter();
    
    // 如果当前选中的是这个记录，刷新详情显示
    if (selectedId === rec.id) {
      selectRecord(rec.id);
    }
  }

  // 原始解密功能已被移除
  function tryDecryptBodies(rec, fnName) {
    // 此函数已被禁用
    return;
  }

  function tryParseJson(text) {
    const trimmed = String(text).trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch (_) { return text; }
    }
    return text;
  }

  // AES解密函数
  function aesDecrypt(dataValue, keyValue, ivValue) {
    try {
      if (!keyValue || !dataValue) return null;
      
      // 数据预处理
      let cleanData = String(dataValue).trim();
      
      // 检查是否是有效的Base64字符串
      if (!/^[A-Za-z0-9+/=]+$/.test(cleanData)) {
        console.warn('AES解密警告: 数据不是有效的Base64格式');
        return null;
      }
      
      const keyStr = CryptoJS.enc.Utf8.parse(keyValue);
      let decrypt = "";
      
      // 尝试不同的解密方式
      const attempts = [];
      
      if (ivValue) {
        // CBC模式
        const ivStr = CryptoJS.enc.Utf8.parse(ivValue);
        attempts.push({
          name: 'CBC',
          config: { mode: CryptoJS.mode.CBC, iv: ivStr, padding: CryptoJS.pad.Pkcs7 }
        });
      }
      
      // ECB模式
      attempts.push({
        name: 'ECB',
        config: { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
      });
      
      for (const attempt of attempts) {
        try {
          decrypt = CryptoJS.AES.decrypt(cleanData, keyStr, attempt.config);
          
          // 检查解密结果是否有效
          if (decrypt && decrypt.sigBytes > 0) {
            // 尝试转换为UTF-8
            try {
              const result = CryptoJS.enc.Utf8.stringify(decrypt);
              if (result && result.length > 0) {
                console.log(`AES解密成功 (${attempt.name}模式):`, result.substring(0, 100) + '...');
                return result;
              }
            } catch (utf8Error) {
              console.warn(`AES解密警告 (${attempt.name}模式): UTF-8转换失败`, utf8Error.message);
              
              // 尝试十六进制输出
              try {
                const hexResult = CryptoJS.enc.Hex.stringify(decrypt);
                if (hexResult && hexResult.length > 0) {
                  console.log(`AES解密成功 (${attempt.name}模式，十六进制):`, hexResult.substring(0, 100) + '...');
                  return `[HEX] ${hexResult}`;
                }
              } catch (hexError) {
                console.warn(`十六进制转换也失败:`, hexError.message);
              }
            }
          }
        } catch (decryptError) {
          console.warn(`AES解密失败 (${attempt.name}模式):`, decryptError.message);
        }
      }
      
      return null;
    } catch (e) {
      console.error('AES解密严重错误:', e);
      return null;
    }
  }

  // 从sessionStorage获取AES密钥
  function getAESKeys() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(`(function(){
        try {
          const securityObject = sessionStorage.getItem('securityObject');
          if (!securityObject) return null;
          const parsed = JSON.parse(securityObject);
          return {
            key: parsed.aesKeyValue,
            iv: parsed.aesIvValue
          };
        } catch (e) {
          return null;
        }
      })()`, (result, exc) => {
        resolve(result || null);
      });
    });
  }

  // AES解密记录的请求和响应体
  function tryAESDecryptBodies(rec, keyValue, ivValue) {
    if (!keyValue) return;

    const url = rec.request.url;
    console.log(`开始AES解密处理: ${url}`);

    // 解密请求体
    if (rec.request.body && typeof rec.request.body === 'string' && rec.request.body.length > 0) {
      console.log(`尝试解密请求体，长度: ${rec.request.body.length}`);
      const decryptedReq = aesDecrypt(rec.request.body, keyValue, ivValue);
      if (decryptedReq) {
        rec.request.aesDecryptedBody = tryParseJson(decryptedReq);
        console.log('请求体解密成功');
      }
    }

    // 解密plainBody（如果存在）
    if (rec.request.plainBody && typeof rec.request.plainBody === 'string' && rec.request.plainBody.length > 0) {
      console.log(`尝试解密请求plainBody，长度: ${rec.request.plainBody.length}`);
      const decryptedPlainReq = aesDecrypt(rec.request.plainBody, keyValue, ivValue);
      if (decryptedPlainReq) {
        rec.request.aesDecryptedPlainBody = tryParseJson(decryptedPlainReq);
        console.log('请求plainBody解密成功');
      }
    }

    // 解密响应体
    if (rec.response?.body) {
      let candidate = null;
      let dataType = '';
      
      if (typeof rec.response.body === 'string') {
        candidate = rec.response.body;
        dataType = 'string';
      } else if (rec.response.body && typeof rec.response.body === 'object' && 'data' in rec.response.body) {
        candidate = rec.response.body.data;
        dataType = 'object.data';
      }
      
      if (candidate && typeof candidate === 'string' && candidate.length > 0) {
        console.log(`尝试解密响应体(${dataType})，长度: ${candidate.length}，前50字符: ${candidate.substring(0, 50)}...`);
        const decryptedResp = aesDecrypt(candidate, keyValue, ivValue);
        if (decryptedResp) {
          rec.response.aesDecryptedBody = tryParseJson(decryptedResp);
          console.log('响应体解密成功');
        }
      }
    }

    // 解密响应plainBody（如果存在）
    if (rec.response?.plainBody) {
      let candidate = null;
      let dataType = '';
      
      if (typeof rec.response.plainBody === 'string') {
        candidate = rec.response.plainBody;
        dataType = 'string';
      } else if (rec.response.plainBody && typeof rec.response.plainBody === 'object' && 'data' in rec.response.plainBody) {
        candidate = rec.response.plainBody.data;
        dataType = 'object.data';
      }
      
      if (candidate && typeof candidate === 'string' && candidate.length > 0) {
        console.log(`尝试解密响应plainBody(${dataType})，长度: ${candidate.length}`);
        const decryptedPlainResp = aesDecrypt(candidate, keyValue, ivValue);
        if (decryptedPlainResp) {
          rec.response.aesDecryptedPlainBody = tryParseJson(decryptedPlainResp);
          console.log('响应plainBody解密成功');
        }
      }
    }
  }

  function init() {
    wireToolbar();
    ensurePageInstrumentation();
    startPollingPlainEvents();
    subscribeToNetwork(); // 现在包含了早期请求捕获
    setupCopyButtons();
    
    // 初始化highlight.js
    if (typeof hljs !== 'undefined') {
      // 本地版本的highlight.js已包含所需语言，无需额外配置
      console.log('Highlight.js已加载，版本:', hljs.versionString || 'unknown');
    }
    
    console.log('网络监控已启动，支持早期请求捕获');
  }
  
  // 设置复制按钮功能
  function setupCopyButtons() {
    // 使用事件委托，因为按钮是动态创建的
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('copy-btn')) {
        const targetId = e.target.getAttribute('data-target');
        if (!targetId) return;
        
        // 获取目标元素的内容
        const targetEl = document.getElementById(targetId.replace('copy-', ''));
        if (!targetEl) return;
        
        // 获取文本内容
        const textToCopy = targetEl.textContent || '';
        
        // 尝试复制到剪贴板
        copyTextToClipboard(textToCopy, e.target);
      }
    });
  }
  
  // 复制文本到剪贴板的兼容性函数
  function copyTextToClipboard(text, buttonEl) {
    // 方法1: 尝试使用现代剪贴板API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showCopySuccess(buttonEl);
        })
        .catch(err => {
          console.warn('现代剪贴板API失败，尝试备用方法:', err);
          fallbackCopyTextToClipboard(text, buttonEl);
        });
    } else {
      // 方法2: 备用方法
      fallbackCopyTextToClipboard(text, buttonEl);
    }
  }
  
  // 备用复制方法
  function fallbackCopyTextToClipboard(text, buttonEl) {
    // 创建临时textarea元素
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 设置样式，使其不可见
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    
    document.body.appendChild(textArea);
    
    try {
      // 选择文本
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999); // 兼容移动设备
      
      // 执行复制命令
      const successful = document.execCommand('copy');
      
      if (successful) {
        showCopySuccess(buttonEl);
      } else {
        showCopyError(buttonEl, '复制命令执行失败');
      }
    } catch (err) {
      console.error('备用复制方法失败:', err);
      showCopyError(buttonEl, '复制失败: ' + err.message);
    } finally {
      // 清理临时元素
      document.body.removeChild(textArea);
    }
  }
  
  // 显示复制成功状态
  function showCopySuccess(buttonEl) {
    buttonEl.classList.add('copy-success');
    buttonEl.textContent = '✓ 已复制';
    
    // 2秒后恢复原状
    setTimeout(() => {
      buttonEl.classList.remove('copy-success');
      buttonEl.textContent = '📋 复制';
    }, 2000);
  }
  
  // 显示复制错误状态
  function showCopyError(buttonEl, errorMsg) {
    buttonEl.classList.add('copy-error');
    buttonEl.textContent = '✗ 失败';
    console.error(errorMsg);
    
    // 2秒后恢复原状
    setTimeout(() => {
      buttonEl.classList.remove('copy-error');
      buttonEl.textContent = '📋 复制';
    }, 2000);
  }

  function ensurePageInstrumentation() {
    const code = `(function(){
      if (window.__NC_INSTALLED__) return true;
      Object.defineProperty(window, '__NC_INSTALLED__', { value: true, configurable: false });
      window.__NC_EVENTS__ = [];
      function push(evt){ try{ window.__NC_EVENTS__.push(evt);}catch(e){} }
      function now(){ return Date.now(); }
      // Axios interceptors
      try {
        var ax = window.axios;
        if (ax && ax.interceptors) {
          ax.interceptors.request.use(function(config){
            try{
              var url = (config.baseURL||'') + (config.url||'');
              var body = config.data;
              if (typeof body === 'string') { try{ body = JSON.parse(body);}catch(_){}}
              push({ type: 'axios-req', sentAt: now(), method: String((config.method||'GET')).toUpperCase(), url: url, body: body, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            }catch(_){ }
            return config;
          });
          ax.interceptors.response.use(function(resp){
            try{
              var url = ((resp.config&&resp.config.baseURL)||'') + ((resp.config&&resp.config.url)||'');
              push({ type: 'axios-res', recvAt: now(), method: String((resp.config&&resp.config.method)||'GET').toUpperCase(), url: url, data: resp && resp.data, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            }catch(_){ }
            return resp;
          });
        }
      } catch(_) {}
      // fetch wrapper
      try {
        var of = window.fetch;
        if (typeof of === 'function' && !of.__nc_patched) {
          function parseMaybeJson(t){ try { return JSON.parse(t); } catch(_) { return t; } }
          var patched = function(input, init){
            var url = (typeof input==='string' ? input : (input && input.url)) || '';
            var method = (init && init.method) || (input && input.method) || 'GET';
            var body = init && init.body;
            if (typeof body !== 'string' && body != null) { try{ body = JSON.stringify(body);}catch(_){ body = String(body);} }
            push({ type: 'fetch-req', sentAt: now(), method: String(method).toUpperCase(), url: url, body: body, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            return of.apply(this, arguments).then(function(resp){
              try {
                var clone = resp.clone();
                clone.text().then(function(text){
                  push({ type: 'fetch-res', recvAt: now(), method: String(method).toUpperCase(), url: url, data: parseMaybeJson(text), path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
                });
              } catch(_) {}
              return resp;
            });
          };
          patched.__nc_patched = true;
          window.fetch = patched;
        }
      } catch(_) {}
      // XHR wrapper
      try {
        var oOpen = XMLHttpRequest.prototype.open;
        var oSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url){ this.__nc_method = method; this.__nc_url = url; return oOpen.apply(this, arguments); };
        XMLHttpRequest.prototype.send = function(body){
          var b = body;
          if (typeof b !== 'string' && b != null) { try { b = JSON.stringify(b); } catch(_) { b = String(b); } }
          var url = this.__nc_url || '';
          var method = (this.__nc_method||'GET');
          push({ type: 'xhr-req', sentAt: now(), method: String(method).toUpperCase(), url: url, body: b, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
          this.addEventListener('loadend', function(){
            try {
              var data = this.response;
              push({ type: 'xhr-res', recvAt: now(), method: String(method).toUpperCase(), url: url, data: data, path: (function(u){ try{var a=new URL(u, location.href); return a.pathname + a.search;}catch(_){return u;} })(url) });
            } catch(_) {}
          });
          return oSend.apply(this, arguments);
        };
      } catch(_) {}
      return true;
    })();`;
    chrome.devtools.inspectedWindow.eval(code, function () {});
  }

  function startPollingPlainEvents() {
    setInterval(() => {
      chrome.devtools.inspectedWindow.eval(`(function(){ var ev = window.__NC_EVENTS__||[]; window.__NC_EVENTS__=[]; return ev; })()`, (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        ingestPlainEvents(events);
        // Try to attach to recent records
        const start = Math.max(0, allRecords.length - 50);
        for (let i = start; i < allRecords.length; i++) {
          tryAttachPlainBodies(allRecords[i]);
        }
        if (selectedId) selectRecord(selectedId);
      });
    }, 500);
  }

  function ingestPlainEvents(events) {
    for (const e of events) {
      const method = String(e.method || '').toUpperCase();
      const keyFull = method + ' ' + String(e.url || '');
      const keyPath = method + ' ' + String(e.path || '');
      const keys = [keyFull, keyPath];
      for (const k of keys) {
        if (!pendingByKey.has(k)) pendingByKey.set(k, { reqs: [], ress: [] });
        const bucket = pendingByKey.get(k);
        if (e.type.endsWith('req')) bucket.reqs.push(e);
        else if (e.type.endsWith('res')) bucket.ress.push(e);
      }
    }
  }

  function tryAttachPlainBodies(rec) {
    const method = String(rec.request.method || '').toUpperCase();
    const url = String(rec.request.url || '');
    const path = extractPath(url);
    const keys = [method + ' ' + url, method + ' ' + path];
    for (const k of keys) {
      const bucket = pendingByKey.get(k);
      if (!bucket) continue;
      // Attach request body: select the nearest sentAt before or around start time
      if (rec.request.plainBody == null && bucket.reqs.length) {
        const started = rec.startedDateTime ? new Date(rec.startedDateTime).getTime() : undefined;
        let best = null;
        if (started != null) {
          let bestDiff = Infinity;
          for (const e of bucket.reqs) {
            const diff = Math.abs((e.sentAt || 0) - started);
            if (diff < bestDiff) { bestDiff = diff; best = e; }
          }
        } else {
          best = bucket.reqs[0];
        }
        if (best) rec.request.plainBody = tryParseJson(best.body);
      }
      // Attach response body
      if (rec.response && rec.response.plainBody == null && bucket.ress.length) {
        let best = bucket.ress[0];
        rec.response.plainBody = tryParseJson(best.data);
      }
      // Optionally clean up to prevent unbounded growth
      if (bucket.reqs.length > 1000) bucket.reqs.splice(0, 800);
      if (bucket.ress.length > 1000) bucket.ress.splice(0, 800);
    }
  }

  function extractPath(u) {
    try { const a = new URL(u); return a.pathname + a.search; } catch (_) { return u; }
  }

  // 主题切换功能
  function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    
    // 从localStorage加载主题设置，默认为浅色主题
    const savedTheme = localStorage.getItem('devtools-theme') || 'light';
    applyTheme(savedTheme);
    
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('devtools-theme', newTheme);
    });
  }
  
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    themeToggle.title = theme === 'light' ? '切换到深色主题' : '切换到浅色主题';
  }

  init();
  initTheme();
})();



# AES - AES解密增强版

一个强大的Chrome DevTools扩展，用于记录和检查所有网络请求和响应，特别支持AES加密数据的自动解密功能。

## ✨ 最新更新 - Vue DevTools风格美化

**界面全面升级！** 参考Vue DevTools的设计理念，打造更现代、更专业的开发者工具界面：

### 🎨 视觉升级
- **浅色主题**: 默认清新的浅色主题，清晰易读
- **主题切换**: 支持浅色/深色主题一键切换，设置会自动保存
- **Vue绿配色**: 采用Vue.js标志性的绿色作为强调色
- **现代化UI**: 圆角设计、阴影效果、流畅过渡动画

### 🎯 交互优化  
- **智能状态标签**: HTTP状态码使用彩色徽章显示
- **方法标签**: 请求方法使用不同颜色的标签区分
- **悬浮提示**: 重要信息支持鼠标悬浮查看详情
- **响应式布局**: 小屏幕自动切换为垂直布局

### 🔧 细节改进
- **图标丰富**: 工具栏按钮增加emoji图标，更直观易懂
- **自定义滚动条**: 美化的滚动条样式
- **代码高亮**: 深色主题适配的语法高亮
- **平滑动画**: 所有交互都有流畅的过渡效果

## 🚀 功能特性

### 📊 网络监控
- **全面捕获**: 记录所有HTTP/HTTPS网络请求和响应
- **多种方式**: 支持fetch、axios、XMLHttpRequest等不同请求方式
- **实时监控**: 实时显示网络活动，支持暂停/恢复
- **智能过滤**: 按URL、方法、状态码、类型等多维度过滤

### 🔐 AES解密功能
- **自动解密**: 从sessionStorage自动获取AES密钥进行解密
- **多模式支持**: 支持AES-CBC和AES-ECB加密模式
- **实时处理**: 新请求自动解密，已有记录批量解密
- **智能识别**: 自动识别加密数据并尝试解密

### 📱 用户界面
- **直观显示**: 解密数据优先显示，使用绿色标识和🔓图标
- **多层展示**: 同时显示原始数据、AES解密数据和函数解密数据
- **JSON格式化**: 自动解析和美化JSON数据
- **响应式设计**: 适配不同屏幕尺寸

## 📦 安装方法

### 方法一：开发者模式安装（推荐）
1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择包含此扩展的文件夹
5. 扩展安装完成

### 方法二：打包安装
1. 将扩展打包为.crx文件
2. 拖拽到Chrome扩展管理页面进行安装

## 🔧 使用方法

### 基础使用

1. **打开DevTools**
   - 按 `F12` 或右键选择"检查"
   - 切换到 "Network Console" 标签页

2. **开始监控**
   - 扩展会自动开始捕获网络请求
   - 使用"Pause"按钮暂停/恢复监控
   - 使用"Clear"按钮清空记录

3. **查看详情**
   - 点击任意网络请求行查看详细信息
   - 切换Overview、Request、Response、Headers、Timing标签页

### AES解密配置

#### 步骤1：准备AES密钥
确保在目标网站的sessionStorage中存储了加密配置：

```javascript
// 在浏览器控制台或网站代码中设置
const securityObject = {
    aesKeyValue: "your-32-character-aes-key-here",  // AES密钥（32字符）
    aesIvValue: "your-16-character-iv-here"        // IV向量（16字符，可选）
};

sessionStorage.setItem('securityObject', JSON.stringify(securityObject));
```

#### 步骤2：启用AES解密
1. 勾选工具栏中的 "AES Decrypt" 复选框
2. 点击 "AES Apply" 按钮对已有记录进行批量解密
3. 新的网络请求将自动进行AES解密

#### 步骤3：查看解密结果
解密结果会在Request和Response标签页中显示：
- 🔓 **AES Decrypted Body**: AES解密后的数据（绿色，优先显示）
- ⚙️ **Function Decrypted Body**: 函数解密的数据（黄色）
- 📄 **Original Body**: 原始加密数据
- 📋 **Original Plain Body**: 原始明文数据

### 高级功能

#### 过滤功能
- **URL过滤**: 在过滤框输入URL关键词
- **方法过滤**: 选择特定的HTTP方法（GET、POST等）
- **复合过滤**: 支持按URL、方法、状态码、类型等组合过滤

#### 导出功能
- 点击"Export JSON"按钮将所有记录导出为JSON文件
- 导出文件包含原始数据和解密数据

#### 函数解密（兼容原功能）
- 在"Page decrypt fn"输入框中输入页面中的解密函数名
- 勾选"Decrypt"复选框并点击"Apply"进行函数解密

## 🔒 安全说明

### 密钥安全
- AES密钥仅在页面上下文中访问，不会被扩展存储
- 密钥通过Chrome DevTools API安全传递
- 解密过程在本地进行，不涉及网络传输

### 支持的加密模式
- **AES-CBC**: 需要提供密钥和IV（推荐）
- **AES-ECB**: 仅需要密钥（不推荐用于生产环境）

### 数据处理
- 自动检测和处理JSON格式的加密数据
- 支持`{data: "encrypted_string"}`格式的API响应
- 错误处理确保解密失败不影响原有功能

## 📋 技术规格

### 系统要求
- Chrome 88+ 或基于Chromium的浏览器
- Manifest V3 支持

### 依赖库
- **CryptoJS**: AES加密解密库
- **Native APIs**: Chrome DevTools API、DOM API

### 文件结构
```
networkConsole/
├── manifest.json          # 扩展配置文件
├── devtools.html         # DevTools页面
├── devtools.js          # DevTools脚本
├── panel.html           # 主面板HTML
├── panel.js             # 主面板逻辑
├── js/                  # 库文件目录
│   ├── core.js         # CryptoJS核心
│   ├── aes.js          # AES算法
│   ├── cipher-core.js  # 加密核心
│   ├── enc-base64.js   # Base64编码
│   ├── mode-ecb.js     # ECB模式
│   ├── lib-typedarrays.js
│   ├── index.js        # 解密工具函数
│   └── jquery.min.js   # jQuery库
└── README.md           # 使用说明
```

## 🛠️ 开发指南

### 本地开发
1. 克隆或下载项目到本地
2. 修改代码后重新加载扩展
3. 在Chrome扩展管理页面点击"重新加载"

### 自定义配置
可以修改以下配置以适应特定需求：

```javascript
// 在panel.js中修改sessionStorage读取逻辑
function getAESKeys() {
    // 自定义密钥获取逻辑
}

// 在panel.js中修改解密逻辑
function aesDecrypt(dataValue, keyValue, ivValue) {
    // 自定义解密算法
}
```

## 📞 支持与反馈

### 常见问题

**Q: 为什么解密失败？**
A: 请检查：
- sessionStorage中是否正确设置了securityObject
- AES密钥长度是否为32个字符
- IV长度是否为16个字符（CBC模式）
- 加密数据格式是否正确

**Q: 支持哪些数据格式？**
A: 支持：
- 直接的AES加密字符串
- `{data: "encrypted_string"}`格式的JSON
- Base64编码的加密数据

**Q: 如何处理不同的加密模式？**
A: 
- 提供IV时自动使用CBC模式
- 未提供IV时使用ECB模式
- 可在代码中自定义其他模式

### 更新日志

#### v1.1.0 (最新)
- ✨ 新增AES解密功能
- 🎨 优化解密结果显示顺序
- 🔧 支持从sessionStorage自动获取密钥
- 📱 改进用户界面和交互体验

#### v1.0.0
- 🎉 基础网络监控功能
- 📊 多种请求方式支持
- 🔍 智能过滤和搜索
- 📤 数据导出功能

---

💡 **提示**: 如果遇到问题或有功能建议，请检查浏览器控制台的错误信息，或参考上述常见问题解答。
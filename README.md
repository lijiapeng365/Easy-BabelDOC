# Easy-BabelDOC

基于BabelDOC API的Web翻译应用，提供PDF文档翻译功能。

## 功能特性

- 📄 PDF文档上传和翻译
- 🌐 多语言支持（中文、英文、日文、韩文等）
- 🤖 多种AI模型选择（GPT-4o、GPT-4o Mini等）
- 📊 实时翻译进度监控
- 📥 双语PDF和单语PDF下载
- 📚 词汇表管理
- 📋 翻译历史记录
- ⚙️ 个性化设置

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS 样式框架
- React Router 路由管理
- Zustand 状态管理
- Lucide React 图标库
- Sonner 通知组件

### 后端
- Python FastAPI
- BabelDOC 翻译引擎
- WebSocket 实时通信
- 文件上传和管理

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+
- OpenAI API Key

### 安装和运行

#### 方法一：使用启动脚本（推荐）
```bash
# Windows
double-click start.bat
```

#### 方法二：手动启动

1. **启动后端服务**
```bash
# 激活虚拟环境
backend\venv\Scripts\activate

# 启动后端
python backend/main.py
```

2. **启动前端服务**
```bash
# 安装依赖（首次运行）
npm install

# 启动前端
npm run dev
```

### 访问应用
- 前端：http://localhost:5173
- 后端API：http://localhost:8000
- API文档：http://localhost:8000/docs

## 使用说明

### 1. 配置API密钥
- 访问设置页面
- 输入您的OpenAI API密钥
- 配置默认翻译参数

### 2. 上传和翻译文档
- 在首页上传PDF文件
- 选择源语言和目标语言
- 选择AI模型和其他参数
- 点击开始翻译

### 3. 监控翻译进度
- 实时查看翻译进度
- 查看详细的翻译日志
- 支持取消正在进行的翻译

### 4. 下载翻译结果
- 下载单语PDF（仅翻译内容）
- 下载双语PDF（原文+翻译对照）

### 5. 管理词汇表
- 上传自定义词汇表文件
- 管理和删除词汇表
- 提高翻译准确性

## 项目结构

```
BabelDOC/
├── backend/                 # Python后端
│   ├── venv/               # Python虚拟环境
│   ├── main.py             # FastAPI应用入口
│   └── requirements.txt    # Python依赖
├── src/                    # React前端源码
│   ├── components/         # 组件
│   ├── pages/             # 页面
│   ├── hooks/             # 自定义Hooks
│   └── lib/               # 工具函数
├── public/                # 静态资源
├── .trae/documents/       # 项目文档
├── start.bat             # Windows启动脚本
└── README.md             # 项目说明
```

## 开发说明

### 前端开发
```bash
npm run dev      # 开发模式
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
```

### 后端开发
```bash
# 激活虚拟环境
backend\venv\Scripts\activate

# 安装新依赖
pip install package_name
pip freeze > backend/requirements.txt

# 运行后端
python backend/main.py
```

## API文档

后端提供完整的RESTful API和WebSocket接口：
- 文件上传：`POST /api/upload`
- 开始翻译：`POST /api/translation/start`
- 翻译状态：`GET /api/translation/{task_id}/status`
- 实时进度：`WebSocket /api/translation/{task_id}/ws`
- 下载结果：`GET /api/translation/{task_id}/download`
- 词汇表管理：`/api/glossary/*`

详细API文档请访问：http://localhost:8000/docs

## 注意事项

1. **API密钥安全**：API密钥存储在浏览器本地，请妥善保管
2. **文件大小限制**：建议上传文件不超过50MB
3. **网络连接**：翻译过程需要稳定的网络连接
4. **虚拟环境**：后端使用独立的Python虚拟环境，避免依赖冲突

## 故障排除

### 常见问题

1. **后端启动失败**
   - 检查Python版本是否为3.8+
   - 确认虚拟环境已激活
   - 检查依赖是否正确安装

2. **前端编译错误**
   - 检查Node.js版本是否为18+
   - 删除node_modules重新安装
   - 检查依赖版本兼容性

3. **翻译失败**
   - 检查API密钥是否正确
   - 确认网络连接正常
   - 查看后端日志获取详细错误信息

## 许可证

本项目基于 GNU Affero General Public License (AGPL) v3 许可证开源。

## 贡献

欢迎提交Issue和Pull Request来改进项目！

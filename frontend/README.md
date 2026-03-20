# 饮食追踪与 AI 分析

一个基于 React 的饮食追踪与分析平台，帮助用户记录饮食数据并通过 AI 进行智能分析和推荐。

## 功能特性

- 🍽️ **饮食记录** - 记录每日饮食数据，支持实时记录
- 📊 **数据可视化** - 通过图表直观展示饮食趋势和营养分析
- 🤖 **AI 分析** - 智能分析饮食结构，提供个性化推荐
- 👥 **社区互动** - 浏览和参与饮食健康社区讨论
- 📱 **设备管理** - 管理和绑定智能设备
- 📈 **报告生成** - 生成饮食健康分析报告

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite 5
- **UI 组件库**: Material-UI (MUI)
- **图表库**: ECharts
- **路由管理**: React Router v6
- **样式方案**: Emotion (CSS-in-JS)

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
npm install
```

### 开发环境运行

```bash
npm run dev
```

应用将在 http://localhost:5173 启动。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
frontend/
├── src/
│   ├── api/              # API 接口封装
│   │   ├── auth.js       # 认证相关
│   │   ├── charts.js     # 图表数据
│   │   ├── client.js     # HTTP 客户端
│   │   ├── communities.js # 社区相关
│   │   ├── devices.js    # 设备管理
│   │   ├── meals.js      # 饮食记录
│   │   ├── recommendations.js # 推荐接口
│   │   └── report.js     # 报告接口
│   ├── components/       # 公共组件
│   ├── layout/           # 布局组件
│   ├── pages/            # 页面组件
│   │   ├── Charts.jsx    # 图表分析页
│   │   ├── Communities.jsx # 社区列表页
│   │   ├── Community.jsx # 社区详情页
│   │   ├── Devices.jsx   # 设备管理页
│   │   ├── Home.jsx      # 首页
│   │   ├── Login.jsx     # 登录页
│   │   ├── Meals.jsx     # 饮食记录页
│   │   ├── RealTimeMeals.jsx # 实时记录页
│   │   ├── Recommendations.jsx # 推荐页
│   │   └── Report.jsx    # 报告页
│   ├── App.jsx           # 应用主组件
│   ├── main.jsx          # 应用入口
│   └── index.css         # 全局样式
├── index.html            # HTML 入口
├── vite.config.js        # Vite 配置
├── package.json          # 项目配置
└── .env.example          # 环境变量示例
```

## 环境配置

复制 `.env.example` 为 `.env` 并根据实际情况修改：

```bash
cp .env.example .env
```

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE` | API 基础地址 | `https://api.mit.chenyuxia.com` |
| `VITE_PROXY_TARGET` | 开发环境代理目标地址 | `https://api.mit.chenyuxia.com` |

## API 代理配置

开发环境下，所有 `/api` 和 `/health` 请求会被代理到后端 API 服务器，避免跨域问题。

默认代理目标：`https://api.mit.chenyuxia.com`

可通过设置环境变量 `VITE_PROXY_TARGET` 修改代理目标。

## 开发建议

- 遵循 React 函数组件和 Hooks 开发模式
- 使用 Material-UI 组件库保持 UI 一致性
- API 请求统一使用 `src/api/client.js` 封装的 HTTP 客户端
- 图表开发使用 ECharts 统一封装的 `ChartBlock` 组件

## License

Private

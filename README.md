# K-XYZ 智能餐盒后端

> 基于 Golang 的智能餐盒 IoT + AI 营养管理系统后端服务

## 项目简介

K-XYZ 智能餐盒系统通过 ESP32 硬件设备采集用户进食数据，结合 AI 大模型提供个性化营养建议，并支持社区化健康数据共享。

### 核心功能

- **IoT 数据采集**：ESP32 设备实时上报各分格重量数据，状态机智能识别就餐行为
- **AI 营养引擎**：基于大模型的菜品识别、卡路里计算与个性化营养点评
- **社区健康看板**：用户圈子管理、社区级饮食数据聚合与可视化大屏
- **数据可视化**：个人饮食图表、就餐时序轨迹回放、增量查询与降采样

## 技术栈

- **语言**: Go 1.22
- **Web 框架**: Gin
- **ORM**: GORM
- **数据库**: MySQL 8.0
- **缓存**: Redis 7
- **认证**: JWT (golang-jwt/jwt)

## 快速开始

### 前置要求

- Go 1.22+
- Docker & Docker Compose

### 1. 启动基础设施

```bash
# 拉取镜像
docker pull mysql:8.0
docker pull redis:7-alpine

# 启动 MySQL（请自定义密码）
docker run -d --name kxyz-mysql \
  -e MYSQL_ROOT_PASSWORD=your-mysql-password \
  -e MYSQL_DATABASE=kxyz \
  -p 3306:3306 mysql:8.0

# 启动 Redis
docker run -d --name kxyz-redis \
  -p 6379:6379 redis:7-alpine

# 若容器已存在，直接启动
docker start kxyz-mysql kxyz-redis
```

### 2. 配置环境变量

**PowerShell:**
```powershell
$env:HTTP_PORT="8080"
$env:MYSQL_DSN="root:your-mysql-password@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR="127.0.0.1:6379"
$env:REDIS_PASSWORD=""
$env:REDIS_DB="0"
$env:JWT_SECRET="your-jwt-secret"  # 请自定义
$env:AI_BASE_URL="https://api.openai.com/v1"
$env:AI_MODEL="gpt-4"
$env:AI_API_KEY="your-ai-api-key"  # 请自定义
$env:AI_TEMPERATURE="0.7"
```

**Linux/macOS:**
```bash
export HTTP_PORT="8080"
export MYSQL_DSN="root:your-mysql-password@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
export REDIS_ADDR="127.0.0.1:6379"
export REDIS_PASSWORD=""
export REDIS_DB="0"
export JWT_SECRET="your-jwt-secret"  # 请自定义
export AI_BASE_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4"
export AI_API_KEY="your-ai-api-key"  # 请自定义
export AI_TEMPERATURE="0.7"
```

### 3. 启动服务

```bash
go run ./cmd/server
```

### 4. 健康检查

```bash
curl http://127.0.0.1:8080/api/v1/ping
```

预期响应：
```json
{
  "message": "pong",
  "timestamp": "2026-03-20T09:10:37Z"
}
```

## 项目结构

```
.
├── cmd/server/          # 应用入口
├── internal/
│   ├── api/            # HTTP 处理器
│   ├── config/         # 配置加载
│   ├── middleware/     # 中间件（JWT 认证等）
│   ├── model/          # 数据模型
│   ├── server/         # 路由配置
│   ├── service/        # 业务逻辑层
│   └── store/          # 数据访问层
└── scripts/            # 部署脚本
```

## API 概览

### 认证相关
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录

### 设备管理
- `POST /api/v1/devices/bind` - 绑定设备
- `GET /api/v1/devices` - 查询已绑定设备
- `DELETE /api/v1/devices/{device_id}` - 解绑设备

### 硬件数据
- `POST /api/v1/hardware/telemetry` - 遥测数据上报（ESP32）

### 就餐数据
- `GET /api/v1/meals` - 历史用餐列表
- `GET /api/v1/meals/{meal_id}` - 用餐详情
- `PUT /api/v1/meals/{meal_id}/foods` - 上传菜品信息
- `GET /api/v1/meals/{meal_id}/trajectory` - 就餐轨迹数据
- `GET /api/v1/users/me/statistics/charts` - 个人饮食图表

### AI 服务
- `GET /api/v1/users/me/ai-advice` - 获取 AI 营养建议

### 社区功能
- `POST /api/v1/communities/create` - 创建社区
- `POST /api/v1/communities/{community_id}/join` - 加入社区
- `GET /api/v1/communities` - 我的社区列表
- `GET /api/v1/communities/{community_id}/dashboard` - 社区大屏数据

## 测试

```bash
go test ./...
```

## License

MIT

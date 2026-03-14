# Linux 部署文档（K-XYZ Backend）

本文提供两种部署方式：

- 方式 A（推荐）：Docker Compose 一键部署（可打包镜像）
- 方式 B：二进制 + systemd 部署

## 1. 前置要求

### 方式 A：Docker 部署

- Linux 服务器已安装 Docker 与 Docker Compose 插件
- 服务器已开放 `8080` 端口（或通过 Nginx 反代）

### 方式 B：二进制部署

- Linux 服务器安装 Go 1.22+
- 已准备可访问的 MySQL 8.0+ 与 Redis

---

## 2. 方式 A（推荐）：Docker Compose 部署

### 2.1 拉代码

```bash
git clone <your-repo-url>
cd backend
```

### 2.2 启动

项目已提供：

- `Dockerfile`
- `docker-compose.deploy.yml`

执行：

```bash
docker compose -f docker-compose.deploy.yml up -d --build
```

### 2.3 健康检查

```bash
curl http://127.0.0.1:8080/api/v1/ping
```

预期返回：

```json
{"message":"pong","timestamp":"..."}
```

### 2.4 常用运维命令

```bash
# 查看容器状态
docker compose -f docker-compose.deploy.yml ps

# 查看后端日志
docker compose -f docker-compose.deploy.yml logs -f api

# 重启后端服务
docker compose -f docker-compose.deploy.yml restart api

# 停止服务
docker compose -f docker-compose.deploy.yml down
```

### 2.5 升级与回滚

升级：

```bash
git pull
docker compose -f docker-compose.deploy.yml up -d --build api
```

回滚（回到指定提交）：

```bash
git checkout <commit-id>
docker compose -f docker-compose.deploy.yml up -d --build api
```

### 2.6 数据备份（MySQL）

```bash
docker exec -i kxyz-mysql mysqldump -uroot -p963487158835 kxyz > backup_kxyz.sql
```

---

## 3. 方式 B：二进制 + systemd 部署

### 3.1 构建 Linux 二进制

在项目根目录执行：

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o kxyz-backend ./cmd/server
```

也可用项目内打包脚本：

```bash
chmod +x scripts/package_linux.sh
./scripts/package_linux.sh
```

脚本会输出 `dist/*.tar.gz`，可直接上传到服务器解压部署。

### 3.2 服务器目录与环境变量

示例目录：

```bash
sudo mkdir -p /opt/kxyz-backend
sudo cp kxyz-backend /opt/kxyz-backend/
```

创建环境变量文件 `/etc/kxyz-backend.env`：

```bash
HTTP_PORT=8080
MYSQL_DSN=root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local
REDIS_ADDR=127.0.0.1:6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 3.3 systemd 服务文件

创建 `/etc/systemd/system/kxyz-backend.service`：

```ini
[Unit]
Description=K-XYZ Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kxyz-backend
EnvironmentFile=/etc/kxyz-backend.env
ExecStart=/opt/kxyz-backend/kxyz-backend
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable kxyz-backend
sudo systemctl start kxyz-backend
sudo systemctl status kxyz-backend
```

---

## 4. 故障排查

1. `mysql init failed`  
先检查 MySQL 是否可连、库 `kxyz` 是否存在、`MYSQL_DSN` 是否正确。

2. `redis init failed`  
检查 `REDIS_ADDR`、防火墙与 Redis 监听地址。

3. 接口 500  
先看应用日志，再看 MySQL/Redis 容器日志：

```bash
docker compose -f docker-compose.deploy.yml logs --tail=200 api
docker compose -f docker-compose.deploy.yml logs --tail=200 mysql
docker compose -f docker-compose.deploy.yml logs --tail=200 redis
```

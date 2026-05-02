# 宝拓智图 Docker 与上线文档

## 1. 服务结构
- `nginx`：反向代理，**唯一对外端口 80**
- `web`：Next.js 前端（内部端口 3001）
- `api`：Express API（内部端口 3000）
- `worker`：异步生图任务消费者
- `postgres`：业务数据库（内部端口 5432）
- `redis`：队列与限流（内部端口 6379）
- `migrate`：一次性迁移任务（启动时自动执行）

**安全架构**：只有 Nginx 对外暴露端口，所有其他服务在 Docker 内部网络通信。

## 2. 快速开始（.env 驱动）

### 2.1 准备环境文件
在仓库根目录执行：

```bash
cp .env.example .env
```

至少修改：
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`（与上面数据库账号密码保持一致）
- `ADMIN_EMAILS`（管理员邮箱列表，逗号分隔）

**重要**：`NEXT_PUBLIC_API_BASE_URL` 已改为 `/api`（通过 Nginx 反向代理）

### 2.2 启动

```bash
docker compose -p baotuo up -d --build
```

说明：当前目录名包含中文时，建议始终带 `-p baotuo`，避免 compose 项目名解析问题。

### 2.3 验证

```bash
docker compose -p baotuo ps
docker compose -p baotuo logs -f migrate api worker web nginx
```

访问地址：
- **所有服务**: `http://localhost` 或 `http://YOUR_SERVER_IP`
- 健康检查: `http://localhost/healthz`

路由说明：
- `/` → Web 前端
- `/api/*` → API 后端
- `/uploaded/*` → 上传的文件
- `/image/*` → 图片详情

如果 `migrate` 失败，先看日志定位：

```bash
docker compose -p baotuo logs migrate
```

## 3. 常用运维命令
停止容器：

```bash
docker compose -p baotuo down
```

停止并删除数据卷：

```bash
docker compose -p baotuo down -v
```

更新发布（仅重建业务服务）：

```bash
docker compose -p baotuo up -d --build api worker web nginx
```

## 4. 环境变量说明

### 4.1 基础变量（根目录 `.env`）
- Compose 与端口：`COMPOSE_PROJECT_NAME`、`NGINX_PORT`（默认 80）
- 数据库：`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`
- API/Worker：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`
- Web：`NEXT_PUBLIC_API_BASE_URL=/api`（固定值，通过 Nginx 代理）
- 管理员：`ADMIN_EMAILS`（逗号分隔的邮箱列表）

### 4.2 业务可选变量
- S3：`S3_ENABLED=true` 后补齐 `S3_*`
- CDN：`CDN_BASE_URL`
- 限流与风控：`RATE_LIMIT_*`、`ABUSE_*`

完整参考：`.env.example`

## 5. 生产上线建议
- 主机要求：Docker 24+、Compose v2、建议至少 `2C4G`
- 生产必须更换：`JWT_SECRET`、数据库密码、`NEXT_PUBLIC_ADMIN_ACCESS_CODE`
- 配置管理员邮箱：`ADMIN_EMAILS=admin@example.com,your-email@example.com`
- 若使用对象存储，优先开启 `S3_ENABLED=true`，不要依赖本地卷存储持久化图片
- **端口配置**：默认使用 80 端口，生产环境建议配置 HTTPS（使用 Nginx SSL 或 Cloudflare）

## 6. 常见问题
- 前端无法访问 API：检查 `NEXT_PUBLIC_API_BASE_URL=/api` 是否正确配置。
- `worker` 不消费任务：检查 `redis` 健康状态与 `worker` 日志。
- `migrate` 失败：检查 `DATABASE_URL` 与数据库权限。
- 图片链接错误：检查 `LOCAL_UPLOAD_PUBLIC_BASE_URL` 与反向代理路径一致性。
- 端口冲突：修改 `NGINX_PORT` 环境变量（默认 80）。

## 7. 非 Docker 运行（已有）
- API: `npm run dev:api`
- Worker: `npm run dev:worker`
- Web: `npm run dev:web`

上线前建议执行：

```bash
npm run build -w @baotuo/api
npm run build -w @baotuo/web
```

## 8. 架构优势

### 单端口暴露
- ✅ 只暴露 Nginx 端口（默认 80），其他服务在内部网络
- ✅ 更安全：数据库、Redis、API 不直接暴露
- ✅ 更简单：无需管理多个端口和防火墙规则
- ✅ 更灵活：可以轻松添加 SSL、负载均衡等功能

### Nginx 反向代理
- `/api/*` → API 服务（内部 api:3000）
- `/uploaded/*` → 静态文件
- `/` → Web 前端（内部 web:3001）

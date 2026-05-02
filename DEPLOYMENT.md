# 宝拓智图 Docker 与上线文档

## 1. 服务结构
- `web`：Next.js 前端，默认端口 `6001`
- `api`：Express API，默认端口 `6002`
- `worker`：异步生图任务消费者
- `postgres`：业务数据库
- `redis`：队列与限流
- `migrate`：一次性迁移任务（启动时自动执行）

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
- `NEXT_PUBLIC_API_BASE_URL`（部署域名变化时）

### 2.2 启动

```bash
docker compose -p baotuo up -d --build
```

说明：当前目录名包含中文时，建议始终带 `-p baotuo`，避免 compose 项目名解析问题。

### 2.3 验证

```bash
docker compose -p baotuo ps
docker compose -p baotuo logs -f migrate api worker web
```

访问地址：
- Web: `http://localhost:6001`
- API 健康检查: `http://localhost:6002/healthz`

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
docker compose -p baotuo up -d --build api worker web
```

## 4. 环境变量说明

### 4.1 基础变量（根目录 `.env`）
- Compose 与端口：`COMPOSE_PROJECT_NAME`、`API_PORT`、`WEB_PORT`、`POSTGRES_PORT`、`REDIS_PORT`
- 数据库：`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`
- API/Worker：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`
- Web：`NEXT_PUBLIC_API_BASE_URL`、`NEXT_PUBLIC_IMAGE_HOSTS`

### 4.2 业务可选变量
- S3：`S3_ENABLED=true` 后补齐 `S3_*`
- CDN：`CDN_BASE_URL`
- 限流与风控：`RATE_LIMIT_*`、`ABUSE_*`

完整参考：`.env.example`

## 5. 生产上线建议
- 主机要求：Docker 24+、Compose v2、建议至少 `2C4G`
- 生产必须更换：`JWT_SECRET`、数据库密码
- 建议将 `NEXT_PUBLIC_API_BASE_URL` 设为线上 API 域名（HTTPS）
- 若使用对象存储，优先开启 `S3_ENABLED=true`，不要依赖本地卷存储持久化图片

## 6. 常见问题
- `web` 调用 API 失败：检查 `NEXT_PUBLIC_API_BASE_URL` 是否是浏览器可访问地址。
- `worker` 不消费任务：检查 `redis` 健康状态与 `worker` 日志。
- `migrate` 失败：检查 `DATABASE_URL` 与数据库权限。
- 图片链接错误：检查 `LOCAL_UPLOAD_PUBLIC_BASE_URL` 与反向代理路径一致性。

## 7. 非 Docker 运行（已有）
- API: `npm run dev:api`
- Worker: `npm run dev:worker`
- Web: `npm run dev:web`

上线前建议执行：

```bash
npm run build -w @baotuo/api
npm run build -w @baotuo/web
```

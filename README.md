# Climbing Grit Journal MVP

基于 `攀岩个人成长日志_MVP_PRD_Prompt_v2.pdf` 第 10 节 `Codex / Vibecoding Prompt` 生成的微信小程序 MVP 骨架。

## 当前实现

- 项目内本地后端：`Express + JWT + 文件数据库`
- 登录 / 注册 / 退出登录
- Taro + React + TypeScript 项目结构
- 4 个底部 Tab：`首页 / 记录 / Projects / Stats`
- Home 右上角 `我的` 入口
- Session 记录表单，且明确不包含 `skinRating`
- `+ 添加 Climb` 底部抽屉
- Climb 结果拆分为 `outcome / ascentStyle / betaKnowledge / attemptOutcome`
- Project 页面、Stats 页面、Me 页面
- 服务端持久化 repository 层
- 独立 `grade utility` 与 `metrics` 纯函数
- RouteReference 未来能力预留
- 分享卡图片导出、预览、保存相册
- 媒体选择与服务端记录
- OpenBeta GraphQL 接入：Crags Tab、全球区域搜索、区域下载、本机缓存与详情浏览

## 手动验证

1. 安装依赖：`npm install`
2. 启动后端：`npm run server:start`
3. 启动小程序开发：`npm run dev:weapp`
4. 在小程序里先注册或登录
5. 检查以下链路：
   - 首页显示本周提醒，点击跳到 Stats
   - 记录页可创建 Session，且没有 `skinRating`
   - 记录页通过弹窗添加多个 Climb
   - Project 页可标记 `Sent`
   - Stats 页可生成 Weekly Growth Card
   - 我的页可看到媒体、分享卡历史、导出图片和保存相册
   - Crags 页可进入 `Download a Region`，搜索 OpenBeta 全球区域并保存到本机缓存
   - 退出登录后再次进入会回到登录页

## 本地环境约束

- `npm install` 只会把依赖装到项目内的 `node_modules/`
- Taro 的大部分预编译缓存会落在项目内的 `.taro-cache/`
- `Taro 4` 仍然会在用户目录下使用一个很小的工具配置目录 `~/.taro4.0`
- 这个目录是 Taro 自身限制，当前不能完全挪走，否则编译器会异常
- 构建命令可直接使用：`npm run build:weapp`
- 后端数据文件保存在 `server/data/db.json`
- 前端本地只保留登录态 token 和当前用户信息，不再本地持久化业务数据

## 认证与接口

- 默认后端地址：`http://127.0.0.1:4000/api`
- 小程序登录页：`/pages/login/index`
- 认证方式：邮箱 + 密码，返回 JWT
- 受保护业务接口通过 `Authorization: Bearer <token>` 访问
- OpenBeta 通过本地后端代理访问：`/api/openbeta/areas/search`、`/api/openbeta/countries`、`/api/openbeta/areas/:uuid/download`

## 真机与朋友测试

- 默认构建会把前端接口指向本机：`http://127.0.0.1:4000/api`
- 上传体验版后，手机里的 `127.0.0.1` 指向的是手机自己，不是你的电脑，所以登录一定会失败
- 真机、体验版、朋友联调都需要一个公网可访问的 `https` 后端地址
- 构建前通过环境变量覆盖接口地址：

```bash
TARO_APP_API_BASE_URL=https://your-domain.com/api npm run build:weapp
```

- 同时需要在微信后台配置这个域名为合法 `request` 域名
- 后端默认健康检查地址：`/api/health`

### Railway 快速部署后端

- 这个仓库已经补了 [railway.json](/Users/ella/Documents/New%20project/climbing-grit-journal-mvp/railway.json:1)，Railway 会用 `npm start` 启动后端
- 后端会自动监听 `0.0.0.0`，并优先把 `db.json` 写到 Railway 挂载卷路径
- 按 Railway 官方 Quick Start，可以直接从 GitHub 部署 Node 服务，并为服务生成公开域名：[Railway Quick Start](https://docs.railway.com/quick-start)
- Railway Volume 文档说明，卷会自动通过 `RAILWAY_VOLUME_MOUNT_PATH` 提供挂载路径：[Railway Volumes](https://docs.railway.com/volumes)

推荐步骤：

1. 把当前项目推到 GitHub
2. 登录 Railway，新建 Project，选择 `Deploy from GitHub`
3. 选这个仓库，先直接部署
4. 在服务里点 `Generate Domain`
5. 给服务挂一个 Volume，挂载路径填 `/data`
6. 在 Variables 里确认：
   `JWT_SECRET=你自己的一串随机字符串`
7. 等部署完成后，记下域名，例如 `https://xxx.up.railway.app`
8. 本地重新构建小程序：

```bash
TARO_APP_API_BASE_URL=https://xxx.up.railway.app/api npm run build:weapp
```

9. 微信后台把 `https://xxx.up.railway.app` 配成合法 `request` 域名
10. 重新上传体验版

说明：

- 如果不挂 Volume，Railway 重启或重部署后，本地 JSON 数据可能丢失
- 当前登录体系还是“邮箱 + 密码”，不是微信登录，所以朋友第一次进入仍然需要注册账号

## 微信开发者工具

- 直接以项目根目录导入即可
- 已提供 [project.config.json](/Users/ella/Documents/New%20project/climbing-grit-journal-mvp/project.config.json:1)
- `miniprogramRoot` 已指向 `dist/`
- 当前 `appid` 使用 `wx1055802dcd1608cf`

## 当前 TODO

- 如果要上真机或多人联调，需要把 `src/constants/api.ts` 的接口地址切到可访问主机
- 补齐单元测试与 lint 配置
- 为页面增加更细的空状态、上传进度和后端错误恢复
- 如果后续引入 `@openbeta/sandbag`，只需要替换 `src/utils/grade.ts` 的实现，不需要重写 Stats UI

# AGENTS.md

## 项目技术栈

- 前端：React 19、TypeScript、Vite、React Router、TanStack Query、tRPC Client。
- UI：Tailwind CSS、shadcn/Radix UI 组件、lucide-react 图标。
- 后端：Hono、tRPC、Node.js 20，服务端通过 esbuild 打包。
- 数据库：MySQL 8、Drizzle ORM、Drizzle Kit。
- 部署：Docker Compose、Nginx，默认应用服务运行在容器内 `3000` 端口并由 Nginx 反向代理。
- 外部能力：阿里云 CAPTCHA、阿里云短信验证、SMTP 邮件、图片上传与服务端校验。

## 能力范围

- 可以协助开发前后端功能、页面和交互调整、tRPC API、数据库 schema、查询逻辑、上传逻辑、认证与权限流程。
- 可以协助补充或调整测试、排查类型错误、构建错误、运行时错误和部署问题。
- 可以协助整理部署步骤、数据库同步步骤和服务器排查命令。
- 涉及数据库 schema 变更时，必须在交付说明中明确提醒执行 `drizzle-kit push`，Docker 部署通常使用：

```bash
docker compose exec app npx drizzle-kit push
```

## 约束条件

- 优先沿用项目现有架构、目录结构、组件体系、tRPC 路由方式、Drizzle 查询方式和 Tailwind/shadcn 风格。
- 不做与需求无关的重构、格式化、依赖替换或大范围文件整理。
- 不擅自覆盖、删除、回滚用户已有改动；工作区已有无关改动时应保留并绕开。
- 不提交密钥、令牌、数据库密码、SMTP 密码、阿里云 AccessKey、`.env.local` 或任何生产敏感配置。
- 高风险操作必须先确认，包括生产数据库修改、破坏性文件操作、破坏性 git 操作、批量删除、强制覆盖和线上数据修复。
- 认证、权限、手机号、邮箱、上传、评论、审核、管理员操作等安全相关逻辑必须保留服务端校验，不能只依赖前端限制。
- 上传、富文本、外链、验证码、短信、邮件、会话、权限和审计逻辑修改后，应特别检查安全边界和失败提示。
- UI 修改应保持现有视觉语言，优先使用已有 `src/components/ui` 组件和 lucide-react 图标。

## 交互约定

- 默认使用中文沟通。
- 接到需求后，先查代码和配置，再只询问会影响实现决策的问题。
- 开始编辑前简要说明将修改哪些方面；完成后说明实际改动、验证结果和必要的部署注意事项。
- 如果用户最新明确指令与本文件冲突，以用户最新明确指令为准，但需要提示可能风险。
- 后续 agent 修改本项目时，应先阅读并遵守本文件要求。

## 验证与交付

- 文档类变更至少运行 `git diff --check`。
- 代码变更按风险选择验证项，常用命令为：

```bash
npm.cmd run check
npm.cmd test
npm.cmd run build
```

- 涉及数据库 schema、权限、认证、上传、评论审核、点赞排序等核心行为时，应补充对应 API 或行为验证说明。
- 最终回复应简洁说明：改了什么、验证了什么、是否需要数据库同步或部署操作。

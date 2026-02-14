# Step 31: Social Media Monitor — MCP 安装部署手册

## 前置条件

```bash
# 确认 Node.js 和 npm 可用
node -v   # 需要 18+
npm -v

# Reddit MCP 需要 uv（Python 包管理器）
brew install uv
```

---

## Step 1: Hacker News MCP（免认证，先测通路）

不需要预装，npx 会自动拉取。直接在 Margay 里配置：

**设置 > MCP Servers**，添加：

```json
{
  "mcp-hacker-news": {
    "command": "npx",
    "args": ["-y", "mcp-hacker-news"]
  }
}
```

- **GitHub**: https://github.com/paabloLC/mcp-hacker-news
- **认证**: 无需
- **能力**: 只读（stories, comments, user profiles）

保存后重启会话，发送 `"获取 HN 热门帖子"` 验证。

---

## Step 2: Reddit MCP（免认证）

```bash
# 先确认 uvx 能用
uvx --version
# 如果没装: brew install uv 或 pip install uv
```

**设置 > MCP Servers**，添加：

```json
{
  "mcp-reddit": {
    "command": "uvx",
    "args": ["mcp-reddit"]
  }
}
```

- **GitHub**: https://github.com/adhikasp/mcp-reddit
- **认证**: 无需
- **能力**: 只读（posts, comments, subreddit search, trending）

验证：发送 `"看看 Reddit r/programming 的热帖"`

---

## Step 3: Twitter MCP（需要账号密码）

```bash
# 可以先全局装一下确保能拉到
npm install -g twitter-mcp-server
```

**设置 > MCP Servers**，添加：

```json
{
  "twitter-mcp-server": {
    "command": "npx",
    "args": ["-y", "twitter-mcp-server"],
    "env": {
      "TWITTER_USERNAME": "替换为你的用户名",
      "TWITTER_PASSWORD": "替换为你的密码",
      "TWITTER_EMAIL": "替换为你的邮箱"
    }
  }
}
```

- **GitHub**: https://github.com/taazkareem/twitter-mcp-server
- **认证**: 账号用户名 + 密码 + 邮箱
- **能力**: 读+写（timeline, mentions, search, post, reply）

验证：发送 `"扫描我最近的推文回复"`

---

## 验证清单

| # | 测试项 | 发送消息 | 预期结果 |
|---|--------|---------|---------|
| 1 | HN 读取 | "获取 HN 热门帖子" | 返回 top stories 列表 |
| 2 | Reddit 读取 | "看看 Reddit 上的热帖" | 返回 trending posts |
| 3 | X 读取 | "扫描我最近的推文" | 返回 timeline + 互动数据 |
| 4 | X 回复 | "回复这条评论：xxx" | 生成草稿，确认后发送 |
| 5 | 跨平台摘要 | "生成社交媒体摘要" | 跨平台汇总 + 分类 |
| 6 | 定时监控 | "每天早上 9 点自动扫描" | 创建 cron job |

---

## 注意事项

- 每个 MCP server 首次连接需要几秒启动时间，第一次请求可能稍慢
- 三个 server 相互独立，装哪个就能用哪个平台，不需要全装
- Twitter 如果开了 2FA 可能需要额外配置，参考其 GitHub README
- HN 和 Reddit 目前为只读（Phase 1），回复功能生成建议文本，需手动发布
- X 支持自动回复，但 agent 会先展示草稿让你确认

## Troubleshooting

| 问题 | 解决方案 |
|------|---------|
| "Tool not found" | 对应平台的 MCP server 未配置，检查设置 |
| Twitter 认证失败 | 检查 env 中的用户名/密码/邮箱是否正确 |
| "uvx not found" | `brew install uv` 或 `pip install uv` |
| 连接超时 | MCP server 首次启动较慢，等几秒重试 |
| MCP 工具列表为空 | 重启会话，检查 Margay 日志 |

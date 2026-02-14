# MCP Server Setup Guide for Social Media Monitor

This guide covers how to install and configure the MCP servers needed by the Social Media Monitor skill.

## Overview

| Platform    | Server             | npm Package          | Auth Required             |
| ----------- | ------------------ | -------------------- | ------------------------- |
| X (Twitter) | twitter-mcp-server | `twitter-mcp-server` | Yes (account credentials) |
| Hacker News | mcp-hacker-news    | `mcp-hacker-news`    | No                        |
| Reddit      | mcp-reddit         | `mcp-reddit`         | No                        |

You only need to set up servers for the platforms you want to monitor.

---

## 1. Twitter MCP Server

**GitHub**: [taazkareem/twitter-mcp-server](https://github.com/taazkareem/twitter-mcp-server)

### Install

```bash
npm install -g twitter-mcp-server
```

### Configure in Margay

Go to **Settings > MCP Servers** and add:

```json
{
  "twitter-mcp-server": {
    "command": "npx",
    "args": ["-y", "twitter-mcp-server"],
    "env": {
      "TWITTER_USERNAME": "your_username",
      "TWITTER_PASSWORD": "your_password",
      "TWITTER_EMAIL": "your_email@example.com"
    }
  }
}
```

### Available Tools

| Tool             | Description                  |
| ---------------- | ---------------------------- |
| `get_tweets`     | Get user's timeline tweets   |
| `get_tweet`      | Get a specific tweet by ID   |
| `search_tweets`  | Search tweets by query       |
| `post_tweet`     | Post a new tweet             |
| `reply_to_tweet` | Reply to a specific tweet    |
| `get_user_info`  | Get user profile information |

### Notes

- Uses account credentials, not API keys
- Supports reading and writing (replies, new tweets)
- Rate limits apply — avoid rapid consecutive calls

---

## 2. Hacker News MCP Server

**GitHub**: [paabloLC/mcp-hacker-news](https://github.com/paabloLC/mcp-hacker-news)

### Configure in Margay

Go to **Settings > MCP Servers** and add:

```json
{
  "mcp-hacker-news": {
    "command": "npx",
    "args": ["-y", "mcp-hacker-news"]
  }
}
```

### Available Tools

| Tool             | Description                      |
| ---------------- | -------------------------------- |
| `getItem`        | Get a story/comment by ID        |
| `getUser`        | Get user profile and submissions |
| `getComments`    | Get comments for a story         |
| `getTopStories`  | Get current top stories          |
| `getNewStories`  | Get newest stories               |
| `getBestStories` | Get best stories                 |

### Notes

- Read-only access (no posting via MCP in Phase 1)
- No authentication required
- Uses official HN Firebase API

---

## 3. Reddit MCP Server

**GitHub**: [adhikasp/mcp-reddit](https://github.com/adhikasp/mcp-reddit)

### Configure in Margay

Go to **Settings > MCP Servers** and add:

```json
{
  "mcp-reddit": {
    "command": "uvx",
    "args": ["mcp-reddit"]
  }
}
```

### Available Tools

| Tool                | Description                    |
| ------------------- | ------------------------------ |
| `get_post`          | Get a Reddit post by URL or ID |
| `get_post_comments` | Get comments on a post         |
| `search_subreddit`  | Search within a subreddit      |
| `get_trending`      | Get trending posts             |

### Notes

- Read-only access (no posting via MCP in Phase 1)
- No authentication required
- Requires `uvx` (install via `pip install uv` if not available)

---

## Verification

After configuring, verify each server is working:

1. Open a conversation with the **Social Media Monitor** assistant
2. Ask: "List available MCP tools"
3. You should see tools from each configured server
4. Try a simple read operation: "Get the top HN stories"

If tools are not appearing:

- Check the MCP server configuration in Settings
- Ensure the npm/uvx packages are installed
- Check Margay logs for connection errors

---

## Troubleshooting

### "Tool not found" errors

- The MCP server for that platform is not configured
- Go to Settings > MCP Servers and add the configuration above

### Twitter auth failures

- Double-check username, password, and email in env vars
- Some accounts may require 2FA — check the server's GitHub README for workarounds

### Reddit "uvx not found"

- Install uv: `pip install uv` or `brew install uv`
- Alternatively, use the pip-based approach: `pip install mcp-reddit`

### Connection timeouts

- MCP servers need a few seconds to start up on first use
- Try the request again after a brief pause

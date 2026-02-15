# API Credentials Setup

Configure API credentials for social media platforms. All credentials are stored locally — never committed to code.

## Storage Location

Create `~/.margay-config/social-ops.env`:

```bash
mkdir -p ~/.margay-config
touch ~/.margay-config/social-ops.env
chmod 600 ~/.margay-config/social-ops.env
```

## X (Twitter)

### 1. Get API Access

1. Go to https://developer.x.com/en/portal/dashboard
2. Create a new project and app
3. In app settings, generate:
   - **Bearer Token** (for reading — app-level)
   - **API Key & Secret** + **Access Token & Secret** (for posting — user-level)

### 2. Add to env file

```env
X_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAx...
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_SECRET=your_access_secret
```

### 3. Verify

```bash
npx tsx skills/social-ops/scripts/x-api.ts --test
```

### Notes

- Free tier: 1,500 tweets/month write, 10,000 reads/month
- Bearer token is sufficient for read operations
- OAuth 1.0a keys needed for posting/replying

---

## Reddit

### 1. Create a Script App

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..."
3. Settings:
   - **Name**: margay-social-ops
   - **Type**: script
   - **Redirect URI**: http://localhost:8080
4. Note the **client_id** (under app name) and **client_secret**

### 2. Add to env file

```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

### 3. Verify

```bash
npx tsx skills/social-ops/scripts/reddit-api.ts --test
```

### Notes

- Script apps are for personal use (your own account)
- Rate limit: 60 requests/minute
- No cost

---

## Hacker News

No credentials needed. The HN Firebase API is public and read-only.

```bash
npx tsx skills/social-ops/scripts/hn-api.ts --test
```

---

## GitHub

Uses the `gh` CLI which handles authentication separately.

### 1. Install gh CLI

```bash
# macOS
brew install gh

# Linux
sudo apt install gh

# Windows
winget install GitHub.cli
```

### 2. Authenticate

```bash
gh auth login
```

### 3. Verify

```bash
npx tsx skills/social-ops/scripts/github-tracker.ts --test
```

---

## Audit Log

All operations (including dry-runs) are logged to:

```
~/.margay-config/social-ops-audit.jsonl
```

Each entry includes: action, platform, mode (dry-run/execute/blocked), timestamp.

## Security

- The `social-ops.env` file is chmod 600 (owner-read only)
- Credentials are never logged, displayed, or included in LLM output
- All write operations require explicit `--execute --confirm-token=<token>`
- The audit log provides a complete trail of all social media operations

# Step 14 Margay Branding - Manual Test Checklist

## Setup

```bash
npm start
```

## 1. Window & Titlebar

- [ ] Window title shows **Margay**
- [ ] macOS traffic-light buttons do not overlap with sidebar in collapsed/expanded states
- [ ] Sidebar top app name shows **Margay**

## 2. Login Page (WebUI login if applicable)

- [ ] Page title shows **Margay - Sign In**
- [ ] Brand name shows **Margay**

## 3. Conversation Page - Empty State

- [ ] Quick Actions title: **What can Margay do?** (or localized equivalent)

## 4. Settings - About

- [ ] Settings → About → Heading shows **Margay**

## 5. Settings - WebUI

- [ ] WebUI description text contains **Margay**
- [ ] Browser not supported message contains **Margay**

## 6. Settings - Channels

- [ ] Telegram/Slack/Discord/Lark description text shows **Margay**

## 7. Settings - MCP Import

- [ ] MCP import description text contains **Margay**

## 8. Settings - Skills

- [ ] Engine Native Skills description text contains **Margay**

## 9. Multi-language Verification

- [ ] Switch to **zh-CN** → All above locations show Margay
- [ ] Switch to **ja-JP** → Same
- [ ] Spot-check at least one more locale (ko-KR / tr-TR / zh-TW)

## 10. macOS Specific

- [ ] Menu bar app name shows **Margay** (may only apply in packaged build)
- [ ] Collapsed sidebar: titlebar content does not overlap traffic-light buttons (96px offset)

## Regression - Should Not Break

- [ ] Conversations work (send/receive messages)
- [ ] Workspace selection/switching works
- [ ] ACP connection works (pick an agent, send a message)
- [ ] Settings save/load correctly

> Packaged build verification (`npm run build`) can be done later. Dev mode covers UI text checks above.

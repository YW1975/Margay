---
name: social-monitor
description: Monitor your social media posts across X, Hacker News, and Reddit. Track engagement (replies, comments, upvotes), generate digests, and auto-reply on supported platforms. Use when user asks to check social media feedback, scan posts, reply to comments, or generate engagement reports.
---

# Social Media Monitor Skill

Monitor engagement on your posts across X (Twitter), Hacker News, and Reddit. Scan for replies, comments, and mentions; generate digests; and auto-reply where supported.

## IMPORTANT RULES

1. **MCP tools required** - This skill relies on MCP servers for platform access. If a required MCP tool is unavailable, inform the user and reference `assets/mcp-setup-guide.md` for setup instructions.
2. **Reply caution** - Only auto-reply on X (via `post_tweet`). For HN and Reddit, generate suggested reply text for the user to post manually.
3. **Follow reply guidelines** - All replies (auto or suggested) must follow the tone and strategy in `assets/reply-guidelines.md`.
4. **Rate limiting** - Space out API calls. Do not batch-fire dozens of requests in one go.
5. **Privacy** - Never expose private account tokens or credentials in output.

---

## Prerequisites: MCP Servers

This skill uses the following MCP servers. The user must configure them in Margay settings before use.

| Platform    | MCP Server           | Capabilities                                  | Auth                |
| ----------- | -------------------- | --------------------------------------------- | ------------------- |
| X (Twitter) | `twitter-mcp-server` | Read timeline, mentions, replies; post tweets | Account credentials |
| Hacker News | `mcp-hacker-news`    | Read stories, comments, user submissions      | None required       |
| Reddit      | `mcp-reddit`         | Read subreddits, posts, comments, trending    | None required       |

If a tool call fails with "tool not found" or similar, tell the user:

> The [platform] MCP server is not configured. Please see the setup guide: use `activate_skill` to load `social-monitor`, then check `assets/mcp-setup-guide.md` for installation steps.

---

## Workflows

### 1. Scan — "Scan my X/HN/Reddit"

Scan one or more platforms for engagement on the user's posts.

**X (Twitter):**

1. Use `get_user_tweets` or `get_tweets` to fetch the user's recent tweets
2. Use `search_tweets` to find mentions (`@username`)
3. For each tweet with replies, use `get_tweet` to get reply details
4. Compile engagement: likes, retweets, replies count, notable replies

**Hacker News:**

1. Use `getUser` to get the user's submissions list
2. Use `getItem` for each recent submission to get score and comment count
3. Use `getComments` to fetch comment threads
4. Compile: points, comment count, top comments

**Reddit:**

1. Use `get_post` or search for the user's posts
2. Use `get_post_comments` to fetch comment threads
3. Compile: upvotes, comment count, top comments

**Output format:**

```
## Scan Results — [Date]

### X (@username)
| Post | Likes | RTs | Replies | Notable |
|------|-------|-----|---------|---------|
| "Post excerpt..." | 42 | 12 | 8 | @user asked about... |

### Hacker News (username)
| Submission | Points | Comments | Top Comment |
|-----------|--------|----------|-------------|
| "Title..." | 156 | 34 | user: "..." |

### Reddit (u/username)
| Post | Upvotes | Comments | Top Comment |
|------|---------|----------|-------------|
| "Title..." | 89 | 23 | u/user: "..." |
```

### 2. Reply — "Reply to this comment"

Generate and (where possible) send replies to comments/mentions.

**X (auto-reply):**

1. User identifies the tweet/reply to respond to
2. Draft reply following `assets/reply-guidelines.md`
3. Show draft to user for approval
4. On approval, use `post_tweet` with `in_reply_to_tweet_id` to send
5. Confirm with link to posted reply

**HN / Reddit (suggested reply — Phase 1):**

1. User identifies the comment to respond to
2. Draft reply following `assets/reply-guidelines.md`
3. Present the suggested text:
   > **Suggested reply for [platform]:**
   > [reply text]
   >
   > _Auto-reply is not yet supported for [platform]. Please copy and post manually._

### 3. Digest — "Generate a weekly social media digest"

Compile a cross-platform engagement summary.

**Steps:**

1. Scan all configured platforms (same as Scan workflow)
2. Classify interactions:
   - **Positive**: praise, thanks, endorsement
   - **Questions**: technical questions, how-to requests
   - **Suggestions**: feature requests, improvement ideas
   - **Negative**: complaints, criticism, bugs reported
3. Generate priority list for replies (unanswered questions first, then suggestions)

**Output format:**

```
## Social Media Digest — [Date Range]

### Summary
| Platform | Posts | Total Engagement | New Replies |
|----------|-------|-----------------|-------------|
| X | 5 | 234 | 18 |
| HN | 2 | 312 | 45 |
| Reddit | 3 | 156 | 22 |

### By Category
#### Questions (reply recommended)
1. [X] @user: "How does X feature work?" — on "post excerpt"
2. [HN] user: "Can this handle Y?" — on "submission title"

#### Suggestions
1. [Reddit] u/user: "Would be great if..." — on "post title"

#### Positive Feedback
1. [X] @user: "This is amazing!" — on "post excerpt"

#### Negative / Issues
1. [HN] user: "Doesn't work with..." — on "submission title"

### Recommended Actions
1. Reply to 3 unanswered questions on X
2. Address bug report on HN submission
3. Thank positive feedback on Reddit
```

### 4. Cron Integration — "Set up daily monitoring at 9 AM"

Use the `cron` skill to schedule periodic scans.

**Steps:**

1. Confirm the schedule with the user (time, frequency, platforms)
2. Use `[CRON_CREATE]` to set up the scheduled task:

[CRON_CREATE]
name: Social Media Scan
schedule: 0 9 \* \* \*
schedule_description: Every day at 9:00 AM
message: Scan all my social media platforms and generate a brief engagement summary. Flag any comments that need replies.
[/CRON_CREATE]

3. Confirm the cron job was created
4. Remind the user they can manage it with `[CRON_LIST]` and `[CRON_DELETE]`

---

## Notes

- When scanning multiple platforms, make tool calls in parallel where possible
- If a platform scan fails, report the error and continue with other platforms
- Always show the scan timestamp so the user knows how fresh the data is
- For X auto-replies, always show the draft and get approval before posting

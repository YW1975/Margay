---
name: work-journal
description: Margay QA tracking — record test plans, test results, bugs, and daily progress. All records serve as bug-fixing context for Ralph and Lisa.
---

# Work Journal — Margay QA Tracker

Track manual testing, bug discovery, and progress for Margay development. Everything before a formal version release is testing. These records help Ralph and Lisa fix bugs.

## File Layout

```
docs/qa/
  journal.md                ← Active journal (append-only, by date)
  archive/
    journal-YYYY-MM.md      ← Monthly rotation when journal.md grows large
  test-plans/
    step35-36.md            ← Test plan files (reference, not destructive move)
```

## Journal Format

`docs/qa/journal.md` structure:

```markdown
# Margay QA Journal

---

## YYYY-MM-DD

### Completed Steps

- [x] Step 35: Skill Architecture Refactor — consensus
- [x] Step 36: Memory Management — consensus

### Test Session: {title}

| #   | Test                   | Result | Notes                            |
| --- | ---------------------- | ------ | -------------------------------- |
| 1.1 | Skill 全可见（Cowork） | PASS   | 13 skills listed                 |
| 2.1 | 记忆目录创建           | FAIL   | directory not created on restart |

### Bugs Found

| ID      | Step | Severity | Description                                      | Status           |
| ------- | ---- | -------- | ------------------------------------------------ | ---------------- |
| S36-001 | 36   | Medium   | memory-manager SKILL.md missing YAML frontmatter | Fixed            |
| S36-002 | 36   | Low      | initStorage overwrite:false skips skill updates  | Known limitation |

### Notes

- {any observations, decisions, or follow-up items}

---
```

## Allowed Values

**Test results**: `PASS`, `FAIL`, `BLOCKED`, `PENDING`

**Bug severity**: `Critical`, `High`, `Medium`, `Low`

**Bug status**: `Open`, `Fixed`, `Known limitation`

**Bug ID format**: `S{step}-{seq}` (e.g., S36-001 = Step 36, bug #1)

## Commands

### Record test result

User says: `记录测试结果 1.1 PASS: 13 skills listed` or `log test 2.1 FAIL: directory missing`

→ Append a row to the current day's Test Session table. Create the table if it doesn't exist for today.

### Record a bug

User says: `记录 bug: memory-manager 没被加载` or `log bug: query-memory.sh wrong path`

→ Append to Bugs Found table. Auto-assign next sequential ID based on current step context.

### Record completed step

User says: `完成了 Step 36` or `step 36 done`

→ Add to Completed Steps list for today.

### Daily summary

User says: `今天完成了什么` or `summarize today`

→ Generate today's Completed Steps section from the journal entries.

### Version release summary

User says: `发布 v1.9.0` or `release v1.9.0`

→ Generate a release summary:

- All steps completed since last release
- Test pass rate (PASS / total)
- Open bugs list
- Archive current journal to `docs/qa/archive/journal-YYYY-MM.md` if large

### Link test plan

User says: `关联测试计划 docs/manual-test-step35-36.md`

→ Copy (not move) the file to `docs/qa/test-plans/` and add a reference in today's journal entry.

## Rules

1. **Always append** — never overwrite or delete existing journal entries
2. **Create if missing** — if `docs/qa/journal.md` doesn't exist, create it with the header
3. **Create dirs if missing** — ensure `docs/qa/`, `docs/qa/archive/`, `docs/qa/test-plans/` exist
4. **Date sections** — each day gets its own `## YYYY-MM-DD` section; reuse if today's section exists
5. **Reference, don't move** — existing test plan files stay in their original location; copy to test-plans/
6. **Timestamps** — use ISO format `YYYY-MM-DD HH:MM` when precision matters
7. **Chinese or English** — follow the user's language in notes; keep table headers in English for parseability

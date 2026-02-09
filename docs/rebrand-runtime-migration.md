# Rebrand: AionUi Runtime Migration Requirements

## Background

The surface-level AionUi → Margay rebrand has been completed in branch `claude/check-branch-pr-status-DxA5c` (398 files), covering copyright headers, documentation, resource images, env var aliases, and MCP agent class rename.

This document covers the **remaining runtime-affecting items** that require data migration logic to avoid breaking existing user data.

---

## Scope

All items below involve persisted state (localStorage, filesystem, SQLite). Changing them without migration will cause data loss or application errors for existing users.

---

## Task 1: localStorage Keys Migration

**Current state:** 6 keys prefixed with `aionui_` in `src/common/storageKeys.ts`

```typescript
// Current keys
WORKSPACE_TREE_COLLAPSE: 'aionui_workspace_collapse_state'
WORKSPACE_PANEL_COLLAPSE: 'aionui_workspace_panel_collapsed'
CONVERSATION_TABS: 'aionui_conversation_tabs'
SIDEBAR_COLLAPSE: 'aionui_sider_collapsed'
THEME: 'aionui_theme'
LANGUAGE: 'aionui_language'
```

**Target:** Rename to `margay_*` prefix with transparent migration.

**Implementation:**
1. Change key values in `storageKeys.ts` to `margay_*` prefix
2. Add a one-time migration function in renderer init that:
   - Reads old `aionui_*` keys from localStorage
   - Writes values to new `margay_*` keys
   - Deletes old keys
   - Sets a `margay_storage_migrated` flag to skip on subsequent runs
3. Call migration before first read of any storage key

**Files:**
- `src/common/storageKeys.ts` — rename values
- `src/renderer/main.tsx` or `src/renderer/bootstrap/` — add migration call
- New: `src/renderer/utils/storageMigration.ts` — migration logic

**Risk:** Low. localStorage is renderer-only, migration is synchronous.

---

## Task 2: User Data Directory Migration

**Current state:** User data stored under `<userData>/aionui/` (see `src/process/utils.ts:15,73`)

```typescript
// src/process/utils.ts
return path.join(rootPath, 'aionui');          // line 15
const dataPath = path.join(rootPath, 'aionui'); // line 73
```

Also: `~/.aionui-config/` for user-level assistant/skill overrides (see `docs/architecture.md:127`).

**Target:** `<userData>/margay/` and `~/.margay-config/`

**Implementation:**
1. Update path references in `src/process/utils.ts`
2. Add migration in `src/process/initStorage.ts` (early in app lifecycle):
   - Check if old `aionui/` directory exists and new `margay/` does not
   - Rename (move) old directory to new path
   - Same for `~/.aionui-config/` → `~/.margay-config/`
   - Log migration action
3. Handle edge cases: both directories exist (skip, use new), neither exists (fresh install)

**Files:**
- `src/process/utils.ts` — update path strings
- `src/process/initStorage.ts` — add migration logic
- Any file referencing `aionui-config` path

**Risk:** Medium. Filesystem rename is atomic on same volume. Must happen before any data access.

---

## Task 3: Database `source` Column Migration

**Current state:** `conversations` table has `source TEXT CHECK(source IN ('aionui', 'telegram'))`

```sql
-- src/process/database/migrations.ts:263
ALTER TABLE conversations ADD COLUMN source TEXT CHECK(source IN ('aionui', 'telegram'));
```

Referenced in:
- `src/common/storage.ts:98` — `type ConversationSource = 'aionui' | 'telegram'`
- `src/process/database/types.ts:77` — `source?: 'aionui' | 'telegram'`
- `src/process/database/index.ts:434` — `getLatestConversationBySource(source: 'aionui' | 'telegram')`
- `src/process/bridge/conversationBridge.ts:27` — `source: 'aionui'`

**Target:** Change value from `'aionui'` to `'margay'`

**Implementation:**
1. Add new DB migration:
   ```sql
   -- Step 1: Remove old CHECK constraint (SQLite requires table recreation or pragma)
   -- Step 2: UPDATE conversations SET source = 'margay' WHERE source = 'aionui'
   -- Step 3: Add new CHECK constraint with ('margay', 'telegram')
   ```
   Note: SQLite doesn't support `ALTER COLUMN`. Options:
   - **Option A:** Just UPDATE the data, skip CHECK constraint update (CHECK is soft in SQLite)
   - **Option B:** Full table recreation (safer but more complex)
   Recommend **Option A** for simplicity.
2. Update TypeScript types: `'aionui'` → `'margay'`
3. Update all code references

**Files:**
- `src/process/database/migrations.ts` — add migration
- `src/common/storage.ts` — update type
- `src/process/database/types.ts` — update type
- `src/process/database/index.ts` — update query
- `src/process/bridge/conversationBridge.ts` — update default source

**Risk:** Medium. DB migration must be idempotent. Must handle case where migration already ran.

---

## Task 4: Skill Metadata `managedBy` Migration

**Current state:** Skills distributed by Margay have `managedBy: 'aionui'` in their `.metadata.json`

```typescript
// src/process/task/SkillDistributor.ts
const data: SkillMetadata = { managedBy: 'aionui', builtin, sourceDir: skillDir };
```

Read checks: `data?.managedBy === 'aionui'` in multiple places.

**Target:** Write `'margay'`, read accepts both `'aionui'` and `'margay'`

**Implementation:**
1. Update write path: `managedBy: 'margay'`
2. Update read checks: `['aionui', 'margay'].includes(data?.managedBy)`
3. Optionally: bulk-update existing `.metadata.json` files on startup

**Files:**
- `src/process/task/SkillDistributor.ts` — write new value, read both
- `src/process/bridge/fsBridge.ts` — update read checks
- `src/process/initStorage.ts` — update read checks

**Risk:** Low. Backwards-compatible read, forward-looking write.

---

## Task 5: JWT Issuer Migration

**Current state:** JWT tokens use `issuer: 'aionui'`

```typescript
// src/webserver/auth/service/AuthService.ts
issuer: 'aionui'  // lines 240, 270, 304
```

**Target:** `issuer: 'margay'`

**Implementation:**
1. Change issuer to `'margay'`
2. Accept both `'aionui'` and `'margay'` during token verification (transition period)
3. Optionally: set a version cutoff date after which old issuer is rejected

**Files:**
- `src/webserver/auth/service/AuthService.ts` — update sign & verify

**Risk:** Low. Old tokens will fail verification → users need to re-login once. WebUI already has password reset mechanism. Adding dual-issuer acceptance eliminates even this.

---

## Task 6: Rename Aion* UI Components (Optional)

**Current state:** 5 base components with `Aion` prefix:

| Current | Target |
|---------|--------|
| `AionCollapse.tsx` | `MargayCollapse.tsx` |
| `AionModal.tsx` | `MargayModal.tsx` |
| `AionScrollArea.tsx` | `MargayScrollArea.tsx` |
| `AionSelect.tsx` | `MargaySelect.tsx` |
| `AionSteps.tsx` | `MargaySteps.tsx` |

Exported from `src/renderer/components/base/index.ts`.

**Implementation:**
1. Rename files
2. Rename exported class/function names
3. Update `index.ts` barrel export
4. Update all import sites (use IDE rename or grep)

**Files:**
- `src/renderer/components/base/Aion*.tsx` (5 files)
- `src/renderer/components/base/index.ts`
- All files importing these components

**Risk:** Low but tedious. Pure internal rename, no persisted state.

**Priority:** Low. These are internal component names, not user-facing.

---

## Execution Order

Recommended sequence (dependencies noted):

```
1. Task 4 (Skill metadata)     — independent, low risk
2. Task 5 (JWT issuer)         — independent, low risk
3. Task 1 (localStorage keys)  — independent, low risk
4. Task 2 (Data directory)     — must run before Task 3
5. Task 3 (DB source column)   — depends on data dir being settled
6. Task 6 (Component rename)   — independent, optional
```

## Testing Checklist

- [ ] Fresh install: app starts with new paths, no migration triggered
- [ ] Upgrade from old version: migration runs, data preserved
- [ ] WebUI login works after JWT issuer change
- [ ] Skills imported before migration still load
- [ ] Cron jobs survive migration
- [ ] Conversations list shows correctly after DB migration
- [ ] localStorage preferences (theme, language, sidebar state) preserved
- [ ] `MARGAY_PORT` and `AIONUI_PORT` both work
- [ ] Channel plugin (Telegram/Lark) conversations unaffected

## Notes

- All migrations must be **idempotent** (safe to run multiple times)
- All migrations must be **backwards-compatible** during transition
- Log all migration actions for debugging
- Consider adding a `migration_version` key to track completed migrations

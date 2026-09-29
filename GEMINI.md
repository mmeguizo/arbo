# ARBO Project — AI Agent Workflow Rules

> **IMPORTANT**: Read this file before doing any work on this project.

---

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Planner** | Senior AI agent (architect) | Creates detailed engineering specs in `ai_todo/`. Researches codebase, talks to the client, makes design decisions, writes step-by-step implementation plans with exact code. Does NOT write production code. |
| **Worker** | Implementation AI agent | Picks up plans from `ai_todo/`, implements them step-by-step. Follows the plan exactly. Does NOT make design decisions — if something is ambiguous, check the plan or ask. |

---

## Workflow

1. **Client requests a feature** → Planner creates a detailed plan in `ai_todo/`
2. **Worker picks up the plan** → Implements it file-by-file following the exact instructions
3. **Worker marks tasks as done** → Updates the plan's checklist and `PROJECT_TASKS.md`
4. **Worker runs verification** → `npm run build` must pass with 0 errors before marking complete

---

## Plan File Format (`ai_todo/*.md`)

Every plan file follows this structure:

- **Goal**: What we're building and why
- **Prerequisites**: What the worker needs to read/understand first
- **Firestore Collections**: Exact document schemas (copy-paste ready)
- **Implementation Tasks**: Numbered checklist with exact file paths, exact code to write, exact diffs
- **Verification Checklist**: How to confirm each task works

**Plans are self-contained** — the worker should NOT need to ask questions. If something is unclear in a plan, it's the planner's fault.

---

## Key Project Files to Always Read First

1. `PROJECT_CONTEXT.md` — Tech stack, Firebase config, architecture decisions
2. `SESSION_HANDOVER.md` — Current state, what's built, known issues
3. `PROJECT_TASKS.md` — All tasks across all phases, status tracking
4. `ERD.md` — Database schema (Firestore collections and relationships)

---

## Coding Standards for This Project

- **TypeScript strict mode** — Zero type errors allowed
- **Tailwind CSS v4** — Use native classes, not arbitrary values
- **Firebase Firestore** — NoSQL, collections auto-created on first write
- **Base64 storage** — Documents/images stored as Base64 in Firestore (resize to 600px, 0.6 quality)
- **Real-time listeners** — Use `onSnapshot` for live data, not `getDocs`
- **Notification system** — Use `writeNotification()` from `NotificationContext.tsx` or `broadcastNotification()` for role-wide alerts
- **Page layout** — Every page wraps content in `<Sidebar />` + main content area (follow existing pages like `GrantManagement.tsx`)
- **Role-based routing** — Protect routes via `<ProtectedRoute allowedRoles={[...]}>` in `App.tsx`
- **Lucide icons** — Import from `lucide-react`
- **Date format** — Use `formatDate()` from `src/utils/formatters.ts`
- **CSV export** — Use `exportToCSV()` from `src/utils/formatters.ts`
- **ID generation** — Use format `LOAN-XXXXXX` (6 random digits), similar to `APP-XXXXXX` pattern

---

## Build & Verify

```bash
npm run build    # Must pass with 0 TypeScript errors — ALWAYS run after changes
npm run dev      # Start dev server on localhost:5173 for manual testing
```

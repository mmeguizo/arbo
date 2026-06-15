# ARBO Project Tasks

> **For AI agents**: Read this file at the start of every session. Update task status as you work. Add new tasks as discovered. This file persists across all chat sessions and agents.
>
> **Status key**: `[ ]` todo | `[~]` in-progress | `[x]` done
>
> **Last updated**: 2026-06-15 (ALL 6 PHASES COMPLETE)

---

## Phase 1: Rename "surveyor" → "encoder"

- [x] 1.1 AuthContext.tsx — Change `UserRole` type to `"arb" | "staff" | "encoder" | "admin"`
- [x] 1.2 AdminUsers.tsx — Update role dropdown: "Surveyor" → "Encoder", role value `"surveyor"` → `"encoder"`
- [x] 1.3 Sidebar.tsx — Update encoder nav items, rename role check
- [x] 1.4 ProtectedRoute.tsx — Update `allowedRoles` checks referencing surveyor
- [x] 1.5 StatusBadge.tsx — Update labels, rename correction_surveyor → correction_encoder
- [x] 1.6 Dashboard.tsx — Update role-specific stats from surveyor to encoder
- [x] 1.7 LandTitles.tsx — Rename `surveyorId` → `encoderId`, `surveyorEncodedAt` → `encoderEncodedAt`, update page title/context
- [x] 1.8 ReviewApps.tsx — Update role checks, rename surveyor references, tab labels, modal text
- [x] 1.9 Search.tsx — Update `surveyorId` → `encoderId` in interface and display
- [x] 1.10 AuditLogs.tsx — Update role filter "Surveyor" → "Encoder"
- [x] 1.11 Reports.tsx — Update `surveyorId` → `encoderId`, labels, CSV headers
- [x] 1.12 App.tsx + NotificationBell.tsx — Update route role checks and notification routing
- [ ] 1.13 Verify: `npm run build` passes with 0 TypeScript errors

## Phase 2: New Approval Workflow

- [x] 2.1 StatusBadge.tsx — Removed `forwarded_to_surveyor`, new statuses: `under_review | verified | awarded | disputed`
- [ ] 2.2 ReviewApps.tsx — Remove "Forwarded to Surveyor" tab, restructure tabs
- [ ] 2.3 ReviewApps.tsx — Add "Assign Land & Forward to Admin" button in Under Review tab
- [ ] 2.4 ReviewApps.tsx — Update admin workflow (Verified tab → approve/dispute)
- [ ] 2.5 LandTitles.tsx — Encoder creates titles with `status: "unassigned"`, no ARB assignment
- [ ] 2.6 MyApplication.tsx — Update status display, remove forwarded_to_surveyor references
- [ ] 2.7 Dashboard.tsx — Stats reflect new statuses
- [ ] 2.8 Firestore — Handle legacy `forwarded_to_surveyor` docs gracefully
- [ ] 2.9 Verify: Full workflow test — ARB apply → staff assign land → admin approve → awarded

## Phase 3: Simplify Documents (Birth Cert + Government ID)

- [ ] 3.1 Register.tsx — Remove cedula + brgyCert, add government ID field
- [ ] 3.2 MyApplication.tsx — Remove cedula + brgyCert upload/display, add government ID
- [ ] 3.3 ReviewApps.tsx — Remove cedula + brgyCert preview, add government ID preview
- [ ] 3.4 Firestore — Update documents interface in all files
- [ ] 3.5 Verify: Register form shows only Birth Cert + Government ID + Picture (3 uploads)

## Phase 4: New Title Fields (titleType, cloaType, aspPsdNumber)

- [ ] 4.1 LandTitles.tsx — Add form fields: titleType dropdown, cloaType dropdown (conditional), aspPsdNumber input
- [ ] 4.2 LandTitles.tsx — Update `ExistingTitle` interface + Firestore write
- [ ] 4.3 Search.tsx — Display new fields in search results + detail modal
- [ ] 4.4 MyApplication.tsx — Display new fields in ARB's land title table + certificate modal
- [ ] 4.5 Reports.tsx — Include titleType breakdown if relevant
- [ ] 4.6 Verify: Encoder creates title with all new fields, visible in Search and MyApplication

## Phase 5: Staff Land Assignment with Rules

- [ ] 5.1 Create `src/components/LandAssignmentModal.tsx` — New modal component
- [ ] 5.2 LandAssignmentModal — Fetch available titles (unassigned + splittable CLOA-TCT)
- [ ] 5.3 LandAssignmentModal — Title selection + assignment logic
- [ ] 5.4 LandAssignmentModal — TCT reassignment block (error notification)
- [ ] 5.5 LandAssignmentModal — CLOA-TCT multi-assignment with PSD tracking
- [ ] 5.6 LandAssignmentModal — Subcollection `/landTitles/{titleId}/assignments/{id}` tracking
- [x] 5.7 ReviewApps.tsx — Integrated LandAssignmentModal with "Assign Land & Forward" button
- [ ] 5.8 Reports.tsx — CLOA-TCT split report (search CLOA → show all ARBs + PSDs)
- [ ] 5.9 Verify: TCT can't reassign, CLOA-TCT can split, admin sees assignment report

---

## Completed (Archive)

- [x] **Phase 1** (2026-06-15): Renamed "surveyor" → "encoder" across 13 files. Firestore fields: `surveyorId`→`encoderId`, `surveyorEncodedAt`→`encoderEncodedAt`, `surveyorName`→`encoderName`. Internal status: `correction_surveyor`→`correction_encoder`.
- [x] **Phase 3** (2026-06-15): Simplified documents — removed cedula + brgyCert from Register, MyApplication, ReviewApps. Added governmentId field. Document grid now 3 slots: birthCert, governmentId, picture. Updated Dashboard ARB requirements text.
- [x] **Phase 4** (2026-06-15): Added titleType (tct/cloa/cloa-tct), cloaType (split/field_survey conditional), aspPsdNumber fields to LandTitles form + all 5 Firestore write blocks + prefill/edit handlers. Updated Search and MyApplication interfaces.
- [x] **Phase 6** (2026-06-15): Created PROJECT_TASKS.md with all planned tasks and instructions for AI agents.

---

## Discovered Issues / Future

- [ ] Firestore composite indexes for new queries
- [ ] Graceful handling of legacy `forwarded_to_surveyor` documents
- [ ] Existing surveyor Firestore docs — `surveyorName`, `surveyorId` fields in legacy data
- [ ] Password reset landing page (existing known issue)
- [ ] Mobile responsiveness QA (existing known issue)

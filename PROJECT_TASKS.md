# ARBO Project Tasks

> **For AI agents**: Read this file at the start of every session. Update task status as you work. Add new tasks as discovered. This file persists across all chat sessions and agents.
>
> **Status key**: `[ ]` todo | `[~]` in-progress | `[x]` done
>
> **Last updated**: 2026-09-29 (loan workflow and documentation audit)

---

## Phase 7-14: Major Feature Expansion (2026-06-16)

### Rename Cooperative → Arbo

- [x] 7.1 Sidebar.tsx — "Cooperatives" → "ARBOs"
- [x] 7.2 CooperativeManagement.tsx — All UI labels, page title, modals, error messages
- [x] 7.3 GrantManagement.tsx — Coop target toggle, select labels
- [x] 7.4 MyGrants.tsx — "My Cooperative" → "My ARBO"
- [x] 7.5 GrantCard.tsx — Coop badge labels

### Arbo Head Role + RBAC

- [x] 8.1 AuthContext.tsx — Added `"arbo_head"` to UserRole, `arboId` to UserProfile
- [x] 8.2 ProtectedRoute.tsx — Default route for arbo_head → /arbo-dashboard
- [x] 8.3 Sidebar.tsx — Arbo head nav items (Overview, ARBO Dashboard, CLOA, Grants, Trainings)
- [x] 8.4 CooperativeManagement.tsx — Only admin sees "Create ARBO" button; staff can view + add members
- [x] 8.5 App.tsx — `/cooperatives` allows staff, `/arbo-dashboard` added (arbo_head only)
- [x] 8.6 ArboDashboard.tsx — New page with Members, Trainings, Grants, Loans, Admin Notes tabs

### Grants: Loans + Equipment + Flexible Splits + Material Values

- [x] 9.1 Grant interface — New types: `"loan"` and `"equipment"`; fields: interestRate, loanTermMonths, remainingBalance, equipmentItem, equipmentQuantity, unitValue, splitAmount, totalGrantAmount
- [x] 9.2 GrantManagement — Loan form (interest rate %, term dropdown), Equipment form (item name + qty + unit value), Material unit value field
- [x] 9.3 GrantManagement — Flexible split: per-member amount inputs with running total validation (sum ≤ total)
- [x] 9.4 GrantManagement — KPI cards: Cash, Materials, Loans Outstanding, Equipment Value, Overdue
- [x] 9.5 GrantManagement — Filter tabs: All, Cash, Materials, Loans, Equipment
- [x] 9.6 GrantManagement — Donut chart: 4 segments (cash/materials/loans/equipment)
- [x] 9.7 GrantManagement — Table: type-specific badge colors + amount display
- [x] 9.8 GrantCard.tsx — Updated Grant interface, icons, badges, and display for all 4 types
- [x] 9.9 MyGrants.tsx — Updated Grant interface and Firestore data mapping

### Trainings Module — Admin Side

- [x] 10.1 TrainingManagement.tsx — New page: CRUD for trainings, Firestore `/trainings/` + `/trainingAcknowledgments/`
- [x] 10.2 Training fields: name, purpose, date, status (ongoing/completed), document links (multi-URL)
- [x] 10.3 Assignment: toggle between Individuals (multi-select ARBs cross-coop) and ARBOs (coop multi-select)
- [x] 10.4 Expand training row: view acknowledgment status per user (attending/pending/declined + reason)
- [x] 10.5 Send reminder button per pending user (writes notification)
- [x] 10.6 App.tsx — `/trainings` route (admin only)
- [x] 10.7 Sidebar.tsx — "Trainings" nav item for admin

### Trainings Module — User Side

- [x] 11.1 MyTrainings.tsx — New page: upcoming + past trainings, acknowledge/decline with reason
- [x] 11.2 Acknowledgment modal: "Will Attend" / "Cannot Attend" + reason textarea
- [x] 11.3 Urgent badge: "X days away" for trainings within 7 days
- [x] 11.4 Writes acknowledgment to `/trainingAcknowledgments/{trainingId}_{userId}`
- [x] 11.5 App.tsx — `/my-trainings` route (arb + arbo_head)
- [x] 11.6 Sidebar.tsx — "My Trainings" nav item for arb + arbo_head
- [x] 11.7 NotificationContext.tsx — Added training_assigned, training_reminder, training_acknowledged types

### ARBO Head Dashboard

- [x] 12.1 Members tab — Real Firestore query, list all members with join date
- [x] 12.2 Trainings tab — Shows all trainings for members, pending/acknowledged/declined counts, nudge button
- [x] 12.3 Grants tab — Table of all grants to members (all 4 types)
- [x] 12.4 Loans tab — Loan-specific table with outstanding balances, interest rates, status
- [x] 12.5 Admin Notes tab — Placeholder (ready for future `/arboNotes/` collection)

### Admin User Management Enhancements

- [x] 13.1 AdminUsers.tsx — Now shows ALL users including ARB and arbo_head
- [x] 13.2 AdminUsers.tsx — Role editing dropdown per user row
- [x] 13.3 AdminUsers.tsx — Create form includes arbo_head role option
- [x] 13.4 AdminUsers.tsx — Role badge colors for arb (slate) and arbo_head (teal)

---

## Completed (Archive — Previous Phases)

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

---

## Phase 15: Loan Management System (2026-06-16)

- [x] 15.1 `src/types/loan.ts` — Loan, payment, ledger types, flat-interest schedule generation, and loan-history checks
- [x] 15.2 `LoanApplication.tsx` — ARB/ARBO Head loan applications, schedules, payment receipts, and income/expense ledger
- [x] 15.3 `LoanManagement.tsx` — Admin approval/rejection, schedule generation, payment verification/disputes, defaults, reminders, term editing, archives, and CSV reporting
- [x] 15.4 `ArboDashboard.tsx` — Cooperative loan portfolio, collection totals, expandable payment history, receipt preview, and payment-receipt monitoring
- [x] 15.5 `App.tsx`, `Sidebar.tsx`, and `NotificationContext.tsx` — Loan routes, navigation, and notification types
- [x] 15.6 Firestore collections — `/loans`, `/loanPayments`, and `/loanIncomeExpenses` are created automatically by the first successful write
- [x] 15.7 Documentation — ERD, project context, and session handover updated for the loan module and Supabase upload URLs
- [x] 15.8 Verification — `npm run build` passes
- [x] 15.9 Loan lifecycle — Completed loans close their account and notify the applicant; defaulted loans close the account and notify the applicant
- [x] 15.10 Profitability detail — Per-ARB income, expenses, net profit, and active balance are sorted and displayed
- [x] 15.11 Payment dispute workflow — Admin and ARBO Head dispute notes are required and visible to applicants
- [x] 15.12 Payment resubmission — Applicants can upload a corrected receipt with resubmission notes
- [x] 15.13 Loan form styling — Applicant loan, payment, and ledger inputs use shared Tailwind styling
- [x] 15.14 Documentation audit — ERD, project context, and session handover reflect the implemented loan module
- [x] 15.15 Cooperative loan splitting — ARBO Heads can assign unequal member shares, including zero allocations, with exact-total validation
- [x] 15.16 ARBO Head participation — Include the cooperative head in participant counts and allocation choices
- [x] 15.17 Rejected loan resubmission — Applicants can correct and resubmit the same rejected loan with required notes
- [x] 15.18 Allocation review styling — Display cooperative allocations as a compact review table
- [x] 15.19 Cooperative resubmission surface — Resubmit rejected cooperative loans from the ARBO Dashboard while keeping My Loans individual-only for resubmission
- [x] 15.20 Per-loan ledger scope — Filter and create income/expense entries for a selected individual or cooperative loan
- [x] 15.21 Cooperative member loan visibility — Include ARBO Head-initiated cooperative loans and shared schedules for linked cooperative members
- [x] 15.22 Cooperative payment ownership — Show all cooperative payment history while restricting payment actions to the assigned member
- [x] 15.23 Early cooperative repayment — Allow a member to submit a full early repayment for their own allocated share
- [x] 15.24 Personal loan isolation — Keep ARBO Head-initiated cooperative history separate from the signed-in member's individual My Loans list
- [x] 15.25 Approval form reset — Clear approval notes and interest rate between loans; require the administrator to enter the rate
- [x] 15.26 Loan notification visibility — Remove notification index dependency, route loan events correctly, notify cooperative audiences, and surface ARBO loan notes

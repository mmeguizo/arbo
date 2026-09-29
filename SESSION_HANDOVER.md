# ARBO Support Web App — Session Handover

> **To the next AI agent**: Read this file first. It contains everything you need to continue this project without asking the user basic questions.
> Last updated: September 29, 2026 (sidebar reorganization and monitoring)

---

## 1. Quick Facts

| Item          | Value                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| App Name      | ARBO (Agrarian Reform Beneficiaries Organization) Support Web App                                    |
| Client        | Department of Agrarian Reform (DAR), Negros Occidental, Philippines                                  |
| Purpose       | Digitize CLOA (Certificate of Land Ownership Award) application & approval pipeline                  |
| Primary Users | ARB farmers, DAR Staff, DAR Encoders, ARBO Heads, District Admin                                |
| Domain        | Deployment URL is environment-specific; check `vercel.json` and the hosting dashboard |

---

## 2. Tech Stack (Exact Versions)

| Layer        | Package                   | Version         |
| ------------ | ------------------------- | --------------- |
| Framework    | React + Vite              | 19.2.6 / 8.0.12 |
| Language     | TypeScript                | 6.0.2 (strict)  |
| Styling      | Tailwind CSS v4 + PostCSS | 4.3.0 / 8.5.15  |
| Routing      | react-router-dom          | 7.16.0          |
| Backend/Auth | Firebase JS SDK           | 12.x             |
| Database     | Cloud Firestore           | (via SDK)       |
| Icons        | lucide-react              | current package version |
| Maps         | leaflet + react-leaflet   | 1.9.4 / 5.0.0   |
| Build        | Vite                      | 8.0.12          |

**Run commands:**

```bash
npm run dev       # Start dev server
npm run build     # TypeScript check + production build
npm run preview   # Preview production build locally
```

---

## 3. Firebase Project

- **Project ID**: `arbo-90356`
- **Auth**: Email/Password only
- **Config file**: `src/firebase/config.ts`
- **API Key**: `AIzaSyBBhHBTlYX50-jRvgO9hYPgNCgOfWrOVuk` (public — Firebase keys are client-safe)
- **Google Maps API Key** (`.env`): `VITE_GOOGLE_MAPS_API_KEY=AIzaSyBgJ_V4g0oVBVUdvUrfEG4xOMM5FvJa6WQ`
  - Currently unused (Leaflet/OSM tiles are free — Google key is spare)

---

## 4. Firestore Collections & Document Schemas

### `/users/{uid}`

```json
{
  "uid": "string",
  "email": "string",
  "name": "string",
  "address": "string",
  "age": "number",
  "contact": "string",
  "barangay": "string",
  "municipality": "string",
  "province": "string",
  "role": "arb | staff | encoder | admin | arbo_head",
  "createdAt": "ISO string",
  "isActive": "boolean (optional)",
  "arboId": "string (optional cooperative ID)"
}
```

### `/applications/{applicationId}`

```json
{
  "applicationId": "string (APP-XXXXXX)",
  "userId": "string (Auth UID)",
  "userName": "string",
  "userBarangay": "string",
  "userMunicipality": "string",
  "userProvince": "string",
  "status": "under_review | forwarded_to_surveyor | verified | awarded | disputed",
  "submittedAt": "ISO string",
  "staffNotes": "string (written by staff)",
  "adminNotes": "string (written by admin)",
  "arbResponse": "string (written by ARB when disputing)",
  "notes": "string (legacy, kept for backwards compat)",
  "reviewedByStaff": "string | null",
  "staffReviewedAt": "ISO string | null",
  "approvedByAdmin": "string | null",
  "adminApprovedAt": "ISO string | null",
  "encoderEncodedAt": "ISO string | null",
  "encoderName": "string | null",
  "titleNumber": "string | null",
  "documents": {
    "birthCert": "base64 string | null",
    "governmentId": "base64 string | null",
    "picture": "base64 string | null"
  }
}
```

### `/landTitles/{titleId}`

```json
{
  "titleId": "string (TTL-XXXXXX)",
  "applicationId": "string",
  "beneficiaryId": "string (Auth UID)",
  "beneficiaryName": "string",
  "titleNumber": "string (e.g. TCT-123456)",
  "lotNumber": "string",
  "areaHectares": "number",
  "province": "string",
  "municipality": "string",
  "geoLat": "string",
  "geoLng": "string",
  "encoderId": "string",
  "encodedAt": "ISO string",
  "landPhotos": "base64 string[] (optional, encoder photos of the land parcel)"
}
```

### `/auditLogs/{autoId}` (immutable, never deleted)

```json
{
  "applicationId": "string",
  "timestamp": "ISO string",
  "actor": "string (name)",
  "actorRole": "staff | admin | encoder | arb",
  "action": "status_change | status_reverted | document_updated | document_removed | land_encoded | arb_response",
  "oldStatus": "string | null",
  "newStatus": "string",
  "notes": "string"
}
```

---

## 5. Approval Workflow (CURRENT — CRITICAL)

```
ARB creates account / application
        │
        ▼
  under_review  ◄──── Staff can "Dispute" (sends back to ARB)
        │                  ARB can "Respond & Resubmit" (comes back to under_review)
        │
  [Staff reviews docs, clicks "Forward for Surveyor Processing"]
        │
        ▼
  forwarded_to_surveyor  ◄── Staff can "Revert to Previous Stage"
        │
  [Surveyor encodes land title + photos + map pin, clicks "Audit and Register"]
        │
        ▼
  verified  ◄── Admin "Approve & Award Title" or "Flag as Disputed"
        │
        ▼
  awarded  (final state — ARB can see land title in "My CLOA Record")
```

**Status values (defined in `StatusBadge.tsx`):**
| Status | Meaning |
|---|---|
| `under_review` | Staff stage — awaiting staff evaluation |
| `forwarded_to_surveyor` | Staff approved — encoder to encode land |
| `verified` | Surveyor encoded — admin to approve |
| `awarded` | Admin approved — complete |
| `disputed` | Any stage — rejected with remarks, ARB can respond |

---

## 6. Current Loan Module

The Phase 15 loan module is implemented and builds successfully.

| Surface | Route | Responsibility |
|---|---|---|
| Applicant loans | `/my-loans` | ARB and ARBO Head applications, payment submissions, schedules, and income/expense ledger |
| Admin management | `/loan-management` | Approval/rejection, flat-interest schedule generation, receipt verification, disputes, defaults, archives, and CSV reporting |
| Cooperative monitoring | `/arbo-dashboard` → Loans | ARBO Head portfolio view and member receipt verification |

The module uses `/loans`, `/loanPayments`, and `/loanIncomeExpenses`. Firestore
creates these collections automatically on their first successful write. Loan
receipts use the shared Supabase Storage helper and save public URLs in
Firestore, rather than embedding Base64 data in loan documents.

Cooperative applications store a `memberAllocations` array with each member's
and the ARBO Head's assigned amount. The head must allocate the full requested
principal: allocations may be unequal and may include zero for a participant
who opts out, but their sum must equal the loan amount. The allocation is shown
to the ARBO Head, applicant, and admin during review.

The admin dashboard also provides a dedicated defaulter/reminder view,
future-payment term editing, manual close/default actions, payment schedule
expansion, and per-ARB profitability rows sorted by net performance. The ARBO
Head dashboard shows collected totals, next due dates, expandable payment
history, and an in-page receipt preview.

Payment review rules are deliberate:

- An admin can verify any applicant payment.
- An ARBO Head can verify member payments in the cooperative portfolio, but
  their own payment remains admin-only.
- Disputing a receipt requires a written reason. The reason is stored on the
  payment and shown to the applicant.
- Applicants can resubmit a corrected Supabase receipt with explanatory notes.
  Resubmission clears the active dispute state but preserves the latest reason
  in `lastDisputeReason`; the balance changes only after verification.

Rejected individual loan applications remain as the same loan record and are
resubmitted from My Loans. Rejected cooperative applications are resubmitted
from the ARBO Dashboard modal. Both flows show the administrator's rejection
reason, preserve cooperative allocations, require correction notes, and return
the application to `pending_approval` (or `needs_review` when the history flag
still applies).

The applicant income/expense ledger supports an explicit loan selector. It can
show all loans and general entries or isolate one individual/cooperative loan.
New entries inherit the selected loan, and loan-payment expenses require a
matching payment from that loan.

Cooperative members can also see cooperative loans initiated by their ARBO Head.
`LoanApplication.tsx` listens to `/cooperativeMembers` for the signed-in user's
cooperative IDs, then includes matching cooperative loans and their shared
payment schedules in the member's loan view.

Cooperative payment records include `memberId` and `memberName`. Members see
all payment history rows, but payment/resubmission controls are rendered only
for rows owned by the signed-in member. The admin loan-management view also
splits legacy unowned cooperative upcoming/overdue/disputed records into
member-owned records using the saved allocation amounts.

`LoanApplication.tsx` keeps the personal My Loans list strict: it uses the
Firebase Auth UID and `applicantType === "individual"`. Cooperative loans are
shown separately as read-only shared history with owner-only payment actions.
Members can also submit a full early repayment for their own remaining
cooperative share; verification marks that member's remaining schedule rows
paid while leaving other members' schedules active.

Notification queries no longer depend on a Firestore `where` + `orderBy`
composite index, which previously caused the notification bell to stay empty
when the index was unavailable. Loan notifications now route admins to Loan
Management, and the ARBO Dashboard Admin Notes tab displays cooperative loan
approval notes, rejection reasons, and resubmission notes.

The flat-interest calculation is:

`interest = principal × rate / 100 × termMonths / 12`

Payment frequencies supported by the schedule generator are monthly, quarterly,
semi-annual, and annual. The final installment receives any rounding remainder.

**Old `pending` status has been REMOVED.** Any existing docs with `pending` in Firestore won't appear in the new tabs.

---

## 6. Files & Their Responsibilities

### Core

| File                                | Purpose                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `src/App.tsx`                       | Route definitions + role-based redirect                                   |
| `src/contexts/AuthContext.tsx`      | `useAuth()` hook — `{ user, profile, loading, refreshProfile, logout }`   |
| `src/components/ProtectedRoute.tsx` | Route guard — checks `allowedRoles`                                       |
| `src/components/Sidebar.tsx`        | Navigation — role-based menu items                                        |
| `src/components/StatusBadge.tsx`    | `ApplicationStatus` type + colored chip component                         |
| `src/firebase/config.ts`            | Firebase init — exports `auth` and `db`                                    |
| `src/supabase/config.ts`            | Supabase client and public `uploads` bucket                                |
| `src/data/locality.json`            | Negros Occidental + Oriental provinces, municipalities, and ALL barangays |

### Pages

| File                | Roles                | Purpose                                                                                        |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `Login.tsx`         | public               | Email/password login with distinct error messages                                              |
| `Register.tsx`      | public               | Multi-step ARB registration (step 1 → personal, step 2 → docs skippable, step 3 → credentials) |
| `Dashboard.tsx`     | admin/staff/encoder | Role-based stats overview                                                                      |
| `MyApplication.tsx` | arb                  | View/upload docs, respond to disputes, see land titles, create new apps                        |
| `ReviewApps.tsx`    | admin/staff          | Dual-pane review: left list, right detail. Forward, dispute, revert, override                  |
| `LandTitles.tsx`    | encoder/admin        | Encode land with Leaflet map pin + photo upload                                                |
| `Search.tsx`        | admin/staff/encoder  | Real-time search across all land titles                                                        |
| `AdminUsers.tsx`    | admin                | Create and edit system users (uses secondary Firebase app)                                    |
| `AuditLogs.tsx`     | admin/staff/encoder  | Immutable audit trail with role filter + search + pagination                                   |
| `LoanApplication.tsx` | arb/arbo_head     | Applications, payment receipts, dispute resubmissions, and ledger                          |
| `LoanManagement.tsx` | admin              | Loan lifecycle, payment review, defaults, and profitability report                         |
| `ArboDashboard.tsx` | arbo_head           | Cooperative portfolio and member payment verification                                      |

---

## 7. What Has Been Built (Current State)

- ✅ **Registration**: 3-step form, barangay cascade (PSGC API with local JSON fallback), doc uploads skippable
- ✅ **Login**: Role-based redirect, distinct error messages per failure type
- ✅ **My Application**: Multiple apps per account, upload/replace/remove docs, respond to disputes, view land titles table with empty state
- ✅ **Review Applications**: 4 tabs (Staff/Surveyor/Admin/Resolved), search, real-time onSnapshot, separate staffNotes/adminNotes, forward/dispute/revert with confirmation dialog, admin override
- ✅ **Surveyor**: Leaflet map with pin-dropping, manual coord entry syncs map, multi-photo upload, duplicate title number detection
- ✅ **Search**: Real-time onSnapshot, filter by title/beneficiary/lot/municipality
- ✅ **Admin Users**: Create staff/encoder users with secondary Firebase app
- ✅ **Audit Logs**: Immutable log on every action, role-scoped visibility, search by App ID, pagination
- ✅ **Sidebar**: Role-based nav, "Help" replaced with "Audit Logs", ARB has single "My CLOA Record"
- ✅ **Dashboard**: Staff/Admin/Surveyor role-specific stats with live Firestore counts
- ✅ **Locality data**: All 57 municipalities with embedded barangays as PSGC API fallback
- ✅ **Loan management**: Individual and cooperative applications, schedules,
  Supabase receipt uploads, admin/ARBO review, defaults, profitability, and
  completion handling
- ✅ **Payment corrections**: Required dispute notes, applicant-facing dispute
  reasons, corrected receipt resubmission, and preserved dispute history
- ✅ **Applicant form styling**: Loan, payment, and income/expense modal inputs
  use explicit Tailwind classes rather than an undefined `.input` selector
- ✅ **Sidebar reorganization**: Admin, staff, and encoder navigation is grouped
  by functional area with collapsible sections; ARB and ARBO Head navigation
  remains intentionally flat.
- ✅ **Beneficiary Monitor** (`/beneficiary-monitor`): Admin-only live profile
  view combining CLOA, loans, payments, grants, income/expenses, trainings,
  and audit activity with risk filters and responsive list/detail navigation.
- ✅ **Farm Monitoring** (`/farm-monitoring`): Admin-only equipment and
  materials view combining grants, resource-related loans, report status,
  report links, filters, and CSV export.
- ✅ **Mobile layout normalization**: Mobile navigation uses a fixed header,
  page shells prevent horizontal overflow, and content receives mobile header
  spacing while retaining desktop layouts.

---

## 8. Known Issues / What to Do Next

### High Priority

- [ ] **Firestore composite indexes**: The `ReviewApps.tsx` query `orderBy("submittedAt", "desc")` on the full `applications` collection needs a composite index. Remove `orderBy` and sort client-side if errors persist.
- [ ] **Surveyor page**: After successful submit, the page shows success then `fetchApprovedApplicants()` refetches. The success message was moved outside the `allApplicants.length === 0` conditional — verify this works.
- [ ] **Document realtime sync**: Staff review uses `onSnapshot` on applications. If document thumbnails don't update when ARB uploads, check that the listener is properly reacting to `documents.*` field changes.
- [ ] **Base64 size limits**: Legacy application documents remain in Firestore and
  may hit the 1MB document limit. Loan receipts already use Supabase Storage.

### Medium Priority

- [ ] **Mobile responsiveness QA**: Run browser/device checks for the fixed
  mobile header, grouped sidebar overlay, monitoring list/detail switching,
  and long-table scrolling.
- [ ] **Edge cases**: What happens when an encoder tries to encode a title that was already encoded? The duplicate check works, but the UI should handle it gracefully.
- [ ] **Profitability Tracking**: Greyed out in sidebar — if client asks, implement as a separate module.
- [ ] **Password reset**: Works via Firebase Auth, but there's no "reset success" landing page for the user after clicking the email link.

### Low Priority

- [ ] **Empty states**: Some pages show "No applications" for the empty state — add more helpful guidance text.
- [ ] **Loading skeletons**: Replace spinner animations with proper skeleton loaders for a more polished UX.
- [ ] **Export to Excel/CSV**: DAR may want to export reports — could be a future feature.
- [ ] **Email notifications**: No notification system when staff forwards or admin approves. Could use Firebase Extensions (like Trigger Email).

---

## 9. Key Architecture Decisions to Be Aware Of

### Secondary Firebase App for Admin User Creation

When an Admin creates a Staff or Encoder account, the app creates a **temporary secondary Firebase app** to avoid logging out the admin:

```typescript
const secondaryApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
const secondaryAuth = getAuth(secondaryApp);
await createUserWithEmailAndPassword(secondaryAuth, email, password);
await deleteApp(secondaryApp);
```

File: `src/pages/AdminUsers.tsx`

### Storage split

Legacy registration documents are stored as Base64 data URIs directly in the
Firestore application document. Images are resized to max 600px at 0.6 quality
JPEG to stay under Firestore's 1MB limit. Loan receipts and shared uploads use
Supabase Storage and store public URLs in Firestore.

**Downside**: Legacy Base64 application documents use Firestore bandwidth
heavily; migrate those documents to Supabase if the app scales.

### PSGC API + Local Fallback

Barangay loading tries the PSGC GitLab API first. If it fails (404, network error), it falls back to local barangay data embedded in `locality.json`. This ensures the app works even if the external API is down.

### Audit Logs Are Immutable

Government-relevant workflow actions write to `/auditLogs/{autoId}` through
`src/utils/audit.ts`. Logs are never deleted or updated — they are append-only
for compliance. The tracked actions include application decisions and document
changes, land survey/title assignment changes, loan submissions and decisions,
payment verification/disputes, cooperative reviews, and account
administration. Staff/encoder users see only their own actions; admin sees all.

---

## 10. Environment & Configuration

### `.env` file

```
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBgJ_V4g0oVBVUdvUrfEG4xOMM5FvJa6WQ
```

Currently unused (Leaflet OpenStreetMap tiles are free). Available for future Google Maps API features.

### Deployment

- `vercel.json` exists in root — likely deployed on Vercel
- No CI/CD configured beyond Vercel auto-deploy from Git

---

## 11. How to Talk to the User

- The user is **Mark** — a junior developer learning to build this app
- He's preparing for a **client demo**
- Explain code flow step-by-step with file/function references
- Show the execution trail: which file calls what function, what Firestore collection is affected
- Use simple terms, avoid unnecessary jargon
- When implementing features, explain the reasoning before writing code

---

## 12. Quick Start for New AI

```
npm install        # Already done — all deps present
npm run dev        # Start on localhost:5173
```

**Test accounts needed** (create via Register or AdminUsers):

1. ARB user → `Register.tsx`
2. Staff user → Admin creates in `/accounts`
3. Surveyor user → Admin creates in `/accounts`
4. Admin user → Create directly in Firebase Console > Authentication

**To understand the workflow**: Register as ARB → Login as Staff to `/review-apps` → Forward to encoder → Login as Encoder to `/land-titles` → Encode title → Login as Admin to `/review-apps` (Admin Stage tab) → Approve.

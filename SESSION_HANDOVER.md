# ARBO Support Web App — Session Handover

> **To the next AI agent**: Read this file first. It contains everything you need to continue this project without asking the user basic questions.
> Last updated: June 8, 2026

---

## 1. Quick Facts

| Item          | Value                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| App Name      | ARBO (Agrarian Reform Beneficiaries Organization) Support Web App                                    |
| Client        | Department of Agrarian Reform (DAR), Negros Occidental, Philippines                                  |
| Purpose       | Digitize CLOA (Certificate of Land Ownership Award) application & approval pipeline                  |
| Primary Users | ARB farmers (beneficiaries), DAR Staff, DAR Surveyors, District Admin                                |
| Domain        | [https://arbo-f5b2a.web.app](https://arbo-f5b2a.web.app) (deployed via Vercel — check `vercel.json`) |

---

## 2. Tech Stack (Exact Versions)

| Layer        | Package                   | Version         |
| ------------ | ------------------------- | --------------- |
| Framework    | React + Vite              | 19.2.6 / 8.0.12 |
| Language     | TypeScript                | 6.0.2 (strict)  |
| Styling      | Tailwind CSS v4 + PostCSS | 4.3.0 / 8.5.15  |
| Routing      | react-router-dom          | 7.16.0          |
| Backend/Auth | Firebase JS SDK           | 12.14.0         |
| Database     | Cloud Firestore           | (via SDK)       |
| Icons        | lucide-react              | 1.17.0          |
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

- **Project ID**: `arbo-f5b2a`
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
  "role": "arb | staff | surveyor | admin",
  "createdAt": "ISO string"
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
  "surveyorEncodedAt": "ISO string | null",
  "surveyorName": "string | null",
  "titleNumber": "string | null",
  "documents": {
    "cedula": "base64 string | null",
    "birthCert": "base64 string | null",
    "brgyCert": "base64 string | null",
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
  "surveyorId": "string",
  "encodedAt": "ISO string",
  "landPhotos": "base64 string[] (optional, surveyor photos of the land parcel)"
}
```

### `/auditLogs/{autoId}` (immutable, never deleted)

```json
{
  "applicationId": "string",
  "timestamp": "ISO string",
  "actor": "string (name)",
  "actorRole": "staff | admin | surveyor | arb",
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
| `forwarded_to_surveyor` | Staff approved — surveyor to encode land |
| `verified` | Surveyor encoded — admin to approve |
| `awarded` | Admin approved — complete |
| `disputed` | Any stage — rejected with remarks, ARB can respond |

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
| `src/firebase/config.ts`            | Firebase init — exports `auth`, `db`, `storage`                           |
| `src/data/locality.json`            | Negros Occidental + Oriental provinces, municipalities, and ALL barangays |

### Pages

| File                | Roles                | Purpose                                                                                        |
| ------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `Login.tsx`         | public               | Email/password login with distinct error messages                                              |
| `Register.tsx`      | public               | Multi-step ARB registration (step 1 → personal, step 2 → docs skippable, step 3 → credentials) |
| `Dashboard.tsx`     | admin/staff/surveyor | Role-based stats overview                                                                      |
| `MyApplication.tsx` | arb                  | View/upload docs, respond to disputes, see land titles, create new apps                        |
| `ReviewApps.tsx`    | admin/staff          | Dual-pane review: left list, right detail. Forward, dispute, revert, override                  |
| `LandTitles.tsx`    | surveyor/admin       | Encode land with Leaflet map pin + photo upload                                                |
| `Search.tsx`        | admin/staff/surveyor | Real-time search across all land titles                                                        |
| `AdminUsers.tsx`    | admin                | Create staff/surveyor accounts (uses secondary Firebase app)                                   |
| `AuditLogs.tsx`     | admin/staff/surveyor | Immutable audit trail with role filter + search + pagination                                   |

---

## 7. What Has Been Built (Current State)

- ✅ **Registration**: 3-step form, barangay cascade (PSGC API with local JSON fallback), doc uploads skippable
- ✅ **Login**: Role-based redirect, distinct error messages per failure type
- ✅ **My Application**: Multiple apps per account, upload/replace/remove docs, respond to disputes, view land titles table with empty state
- ✅ **Review Applications**: 4 tabs (Staff/Surveyor/Admin/Resolved), search, real-time onSnapshot, separate staffNotes/adminNotes, forward/dispute/revert with confirmation dialog, admin override
- ✅ **Surveyor**: Leaflet map with pin-dropping, manual coord entry syncs map, multi-photo upload, duplicate title number detection
- ✅ **Search**: Real-time onSnapshot, filter by title/beneficiary/lot/municipality
- ✅ **Admin Users**: Create staff/surveyor with secondary Firebase app
- ✅ **Audit Logs**: Immutable log on every action, role-scoped visibility, search by App ID, pagination
- ✅ **Sidebar**: Role-based nav, "Help" replaced with "Audit Logs", ARB has single "My CLOA Record"
- ✅ **Dashboard**: Staff/Admin/Surveyor role-specific stats with live Firestore counts
- ✅ **Locality data**: All 57 municipalities with embedded barangays as PSGC API fallback

---

## 8. Known Issues / What to Do Next

### High Priority

- [ ] **Firestore composite indexes**: The `ReviewApps.tsx` query `orderBy("submittedAt", "desc")` on the full `applications` collection needs a composite index. Remove `orderBy` and sort client-side if errors persist.
- [ ] **Surveyor page**: After successful submit, the page shows success then `fetchApprovedApplicants()` refetches. The success message was moved outside the `allApplicants.length === 0` conditional — verify this works.
- [ ] **Document realtime sync**: Staff review uses `onSnapshot` on applications. If document thumbnails don't update when ARB uploads, check that the listener is properly reacting to `documents.*` field changes.
- [ ] **Base64 size limits**: Firestore has 1MB per document limit. Large doc uploads (high-res photos) may hit this. Consider Firebase Storage as alternative.

### Medium Priority

- [ ] **Mobile responsiveness**: Test on actual mobile devices — the Sidebar and layout should work but hasn't been QA'd.
- [ ] **Edge cases**: What happens when a surveyor tries to encode a title that was already encoded? The duplicate check works, but the UI should handle it gracefully.
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

When an Admin creates a Staff/Surveyor account, the app creates a **temporary secondary Firebase app** to avoid logging out the admin:

```typescript
const secondaryApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
const secondaryAuth = getAuth(secondaryApp);
await createUserWithEmailAndPassword(secondaryAuth, email, password);
await deleteApp(secondaryApp);
```

File: `src/pages/AdminUsers.tsx`

### Base64 Document Storage

All 4 document types (cedula, birthCert, brgyCert, picture) are stored as Base64 data URIs directly in the Firestore application document. Images are resized to max 600px at 0.6 quality JPEG to stay under Firestore's 1MB limit. PDFs are also stored as Base64.

**Downside**: This uses Firestore bandwidth heavily. If the app scales, consider migrating to Firebase Storage.

### PSGC API + Local Fallback

Barangay loading tries the PSGC GitLab API first. If it fails (404, network error), it falls back to local barangay data embedded in `locality.json`. This ensures the app works even if the external API is down.

### Audit Logs Are Immutable

Every action writes to `/auditLogs/{autoId}`. Logs are never deleted or updated — they are append-only for government compliance. Staff/surveyor users see only their own actions; admin sees all.

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

**To understand the workflow**: Register as ARB → Login as Staff to `/review-apps` → Forward to surveyor → Login as Surveyor to `/land-titles` → Encode title → Login as Admin to `/review-apps` (Admin Stage tab) → Approve.

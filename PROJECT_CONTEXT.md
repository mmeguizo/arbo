# ARBO Mobile Support Web App — Project Context

> **For the next AI agent**: Read this file AND `SESSION_HANDOVER.md` before making any changes.
> Last updated: September 29, 2026 — See `SESSION_HANDOVER.md` for the complete handover including workflow changes, loan behavior, and known limitations.

---

## 1. What Is This Project?

A **mobile-responsive web application** for the **Department of Agrarian Reform (DAR), Negros Occidental, Philippines**.

The app is called the **ARBO (Agrarian Reform Beneficiaries Organization) Support Web App**. It replaces a proposed mobile app — the client confirmed it should be a **web app that is mobile-responsive**, not a native mobile app.

The primary use case is digitizing the CLOA (Certificate of Land Ownership Award) application and approval pipeline for Agrarian Reform Beneficiaries (ARBs) — i.e., Filipino farmers.

---

## 2. Tech Stack

| Layer              | Technology                                                          |
| ------------------ | ------------------------------------------------------------------- |
| Frontend Framework | React 19 + Vite                                                     |
| Language           | TypeScript 6 (strict mode)                                          |
| Styling            | Tailwind CSS v4 + PostCSS                                           |
| Routing            | React Router DOM v7                                                 |
| Backend / Auth     | Firebase v12 (Web SDK)                                              |
| Database           | Firebase Cloud Firestore (NoSQL)                                    |
| File Storage       | Supabase Storage (`uploads` bucket); Firestore stores public URLs   |
| Icons              | Lucide React                                                        |
| Build Tool         | Vite v8                                                             |

### Important Tailwind v4 Note

Tailwind CSS v4 changed its PostCSS integration. The project uses `@tailwindcss/postcss` (NOT the old `tailwindcss` PostCSS plugin).

**postcss.config.js** must use:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
```

Custom brand colors are defined in `tailwind.config.js`:

- `dar-green` — primary DAR brand green
- `dar-light-green` — lighter variant
- `dar-gold` — accent gold

---

## 3. Firebase Project Details

- **Project ID**: `arbo-90356`
- **Auth Domain**: `arbo-90356.firebaseapp.com`
- **Config file**: `src/firebase/config.ts`

### Firebase Services Used

- **Firebase Authentication** — Email/Password only
- **Cloud Firestore** — Primary database
- **Supabase Storage** — Browser uploads use the shared `src/utils/storage.ts` helper and the public `uploads` bucket; Firebase Storage is not initialized

---

## 4. Firestore Database Structure

> **IMPORTANT**: Firestore is schemaless. Collections and documents are created automatically when your code first writes to them. You do NOT manually create tables.

### Collections (auto-created on first write):

#### `/users/{uid}`

Stores user profiles for all roles.

```json
{
  "uid": "string",
  "email": "string",
  "name": "string",
  "address": "string",
  "age": "number",
  "contact": "string",
  "barangay": "string",
  "role": "arb | staff | encoder | admin | arbo_head",
  "municipality": "string",
  "province": "string",
  "arboId": "string (optional cooperative ID)",
  "createdAt": "ISO string"
}
```

#### `/applications/{uid}`

One application per ARB farmer. Linked by their Auth UID.

```json
{
  "userId": "string",
  "userName": "string",
  "userEmail": "string",
  "userBarangay": "string",
  "status": "under_review | pending | verified | awarded | disputed",
  "submittedAt": "ISO string",
  "notes": "string",
  "reviewedBy": "string",
  "documents": {
    "cedula": "base64 string or null",
    "birthCert": "base64 string or null",
    "brgyCert": "base64 string or null",
    "picture": "base64 string or null"
  },
  "encoderEncodedAt": "ISO string (optional)",
  "encoderName": "string (optional)",
  "titleNumber": "string (optional)"
}
```

#### `/landTitles/{titleId}`

Surveyor-encoded land boundary records.

```json
{
  "titleNumber": "string (e.g. TCT-456789)",
  "lotNumber": "string",
  "beneficiaryId": "string (userId)",
  "beneficiaryName": "string",
  "municipality": "string",
  "areaHectares": "number",
  "geoLat": "string",
  "geoLng": "string",
  "encodedBy": "string (encoderId)",
  "encodedAt": "ISO string"
}
```

---

## 5. User Roles & Access Control

| Role       | Who                    | Access                          |
| ---------- | ---------------------- | ------------------------------- |
| `arb`      | Farmer / Beneficiary   | My Application page only        |
| `staff`    | DAR Municipal Staff    | Dashboard, Review Applications  |
| `encoder` | DAR Encoder             | Dashboard, Land Titles          |
| `arbo_head` | ARBO cooperative head | ARBO dashboard, personal loans, member payment review |
| `admin`    | District Administrator | All pages including Admin Users |

Routes are protected by `ProtectedRoute.tsx` which reads the user's role from Firestore after login.

---

## 6. File Structure

```
src/
├── firebase/
│   └── config.ts              ← Firebase init, exports: auth, db, firebaseConfig
├── supabase/
│   └── config.ts              ← Supabase client and storage bucket configuration
├── contexts/
│   └── AuthContext.tsx         ← useAuth() hook, UserProfile type, UserRole type
├── components/
│   ├── ProtectedRoute.tsx      ← Role-based route guard
│   ├── Sidebar.tsx             ← Responsive navigation panel
│   └── StatusBadge.tsx         ← Colored status chips (exports ApplicationStatus type)
├── pages/
│   ├── Login.tsx               ← Email/Password login
│   ├── Register.tsx            ← Multi-step ARB farmer registration with doc uploads
│   ├── Dashboard.tsx           ← Admin/Staff/Encoder stats overview
│   ├── MyApplication.tsx       ← ARB farmer view of their application
│   ├── ReviewApps.tsx          ← Staff/Admin dual-pane review board
│   ├── LandTitles.tsx          ← Encoder GPS coordinate entry form
│   ├── Search.tsx              ← Search TCT/lot numbers/beneficiary names
│   ├── AdminUsers.tsx          ← Admin creates and edits system users
│   ├── LoanApplication.tsx     ← Applicant loans, payments, and income/expense ledger
│   ├── LoanManagement.tsx      ← Admin approvals, verification, disputes, defaults, and reports
│   └── ArboDashboard.tsx       ← ARBO portfolio and member payment review
├── App.tsx                     ← Route definitions and role-based redirects
├── main.tsx                    ← React root entry point
└── index.css                   ← Tailwind v4 directives + global styles
```

## 7. Loan Management Module

The loan module is available at `/my-loans` for `arb` and `arbo_head` users and
at `/loan-management` for administrators. It uses these Firestore collections,
which are created automatically on the first successful write:

- `/loans` — applications, flat-interest terms, balances, status, and history flags
- `/loanPayments` — generated schedules, submitted receipts, and verification state
- `/loanIncomeExpenses` — optional income and expense ledger entries

Receipts are uploaded through Supabase Storage and the resulting public URL is
stored in Firestore. The admin flow approves or rejects applications, generates
payment schedules, verifies or disputes receipts, marks defaulted loans, and
exports a profitability report. ARBO Heads can review loans tied to their
cooperative and verify member payment receipts, but cannot verify their own
payments.

### Loan lifecycle

1. ARBs and ARBO Heads submit individual applications from `/my-loans`.
   Cooperative members also see approved, pending, or rejected cooperative
   loans for the cooperative IDs linked through `/cooperativeMembers`, even
   though the ARBO Head is the loan applicant.
   The personal loan list itself contains only the signed-in user's
   `individual` loans; cooperative history is rendered in its own section.
2. An ARBO Head submits a cooperative application from the ARBO Dashboard modal.
3. Admin approval updates the loan and generated schedule in a Firestore batch.
4. The applicant uploads a Supabase receipt for an upcoming payment.
5. Admin, or an eligible ARBO Head for a member payment, verifies the receipt.
   Only verification updates `totalPaid` and `remainingBalance`.
6. A reviewer can dispute a receipt only with a written reason. The applicant
   sees the reason, uploads a corrected receipt, and adds resubmission notes.
7. The corrected payment returns to review; a disputed payment never reduces the
   loan balance until verification succeeds.

### Loan collections

- `/loans`: logical `LOAN-XXXXXX` data, terms, balances, status, and
  `applicantType` (`individual` or `cooperative`). Cooperative loans also store
  `memberAllocations`, an array of `{ memberId, memberName, amount }` records
  including the ARBO Head. The allocation total must equal the cooperative
  principal; any participant may have an explicit zero allocation.
- Rejected individual loans are edited and resubmitted from `/my-loans`.
  Rejected cooperative loans are edited and resubmitted from the ARBO Dashboard
  cooperative-loan modal. Both flows update the same `/loans` record with
  required `resubmissionNotes`; the status returns to `pending_approval` or
  `needs_review` without creating a duplicate loan.
- `/loanPayments`: generated schedule entries, Supabase receipt URLs, reviewer
  fields, dispute notes, resubmission audit fields, and optional cooperative
  `memberId`/`memberName` ownership fields.
- Cooperative payment schedules are shared by all members who can see the
  cooperative loan; the applicant's own payments and the visible cooperative
  loan payments are loaded together in the member loan view.
- Cooperative members can view every payment in the shared history, but only
  payment records whose `memberId` matches their account can be submitted or
  resubmitted. Legacy cooperative schedules are split into member-owned
  records by the admin loan-management view.
- A cooperative member with an outstanding owned share can submit a full early
  repayment with a receipt. Admin or eligible ARBO Head verification closes
  that member's remaining schedule rows without closing the cooperative loan
  for other members.
- Loan notifications are stored in `/notifications` and listened to without a
  composite Firestore index requirement. Admin loan events route to
  `/loan-management`; cooperative approval/rejection events are delivered to
  the ARBO Head and allocated members.
- `/loanIncomeExpenses`: optional applicant income and expense ledger entries.
  Entries may include `loanId`; the applicant ledger can filter and manage
  entries for one individual loan, one cooperative loan, all loans, or
  unassigned/general records. Loan-payment expenses must reference a payment
  belonging to the selected loan.

Loan objects have two IDs: the human-readable logical `id` and the Firestore
auto-document ID mapped to `Loan.firestoreId`. Every loan update must use
`loan.firestoreId || loan.id`.

---

## 7. Key Architecture Decisions

### A. Secondary Firebase App for Admin User Creation

When an Admin creates a new Staff/Surveyor account, calling `createUserWithEmailAndPassword` on the default Firebase instance would log out the Admin. Solution: create a temporary secondary `FirebaseApp` instance in memory, register the new user through it, then call `deleteApp()` to destroy it.

```typescript
// In AdminUsers.tsx
const secondaryApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
const secondaryAuth = getAuth(secondaryApp);
await createUserWithEmailAndPassword(secondaryAuth, email, password);
await deleteApp(secondaryApp);
```

### B. No Microfinance / Profitability Module

The "Profitability Tracking" dashboard was removed from active scope. It appears as a greyed-out "Coming Soon" link in the Sidebar to signal future scope to the client.

### C. Storage split

Legacy registration/application documents remain Base64 data in Firestore. Loan
receipts and shared uploads use Supabase Storage through
`src/utils/storage.ts`; only the returned public URL is stored in Firestore.
Firebase Storage is not initialized by the application.

### D. Real-time Live Stats

Dashboard stats now reflect live Firestore counts for total farmers, land titles, and total hectarage. No dummy or mock data is injected. The registry table supports column sorting out of the box.

### E. CLOA Approval Pipeline (4-Stage — Updated June 8)

1. **Under Review** (Staff Stage): ARB registers and uploads documents. Staff may dispute with remarks.
2. **Forwarded to Encoder** (Encoder Stage): Staff verifies docs, forwards to an encoder to encode land boundaries.
3. **Verified** (Admin Stage): Surveyor encodes land title, admin verifies and awards.
4. **Awarded**: Final state. CLOA title visible to ARB in My Application.

> ⚠️ **Note**: The old `pending` status has been replaced with `forwarded_to_surveyor`. Applications stuck on `pending` in Firestore won't appear in the new tabs.

---

## 8. Current Build Status

- **Last successful build**: September 29, 2026
- **Build command**: `npm run build`
- **Build output**: `dist/` folder
- **TypeScript errors**: 0
- **Known warnings**: large Vite bundle and ineffective dynamic imports; neither
  currently blocks the build.

---

## 9. What Still Needs To Be Done

- [ ] **Firestore Setup**: Enable Firestore in Firebase Console (Cloud Firestore, NOT Realtime Database), choose region, set security rules
- [ ] **Create the first Admin account**: Since there's no admin yet, you need to manually register one OR temporarily disable Firestore security rules, let someone register, then manually change their `role` field to `admin` in the Firebase Console
- [ ] **Firestore Security Rules**: Write proper rules so only authenticated users with the right role can read/write each collection
- [ ] **Firebase Hosting**: Deploy `dist/` folder to Firebase Hosting or Netlify for client delivery
- [ ] **Domain setup** (optional): Point a custom domain to the hosted app

---

## 10. How To Run Locally

```bash
# Navigate to project folder
cd "C:\Users\markm\Desktop\SIR BEN\arbo"

# Install dependencies (only needed once)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## 11. Firestore Security Rules Recommendation

Paste these into Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection: only the user themselves or admins can read/write
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && (request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Applications: ARB writes their own, staff/admin/encoder can read all
    match /applications/{appId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == appId;
      allow update: if request.auth != null;
    }

    // Land Titles: encoders and admins write, all authenticated users read
    match /landTitles/{titleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'encoder' ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }
  }
}
```

---

## 12. Municipalities Supported (Negros Occidental)

The app has a hardcoded list of all 31 municipalities in Negros Occidental for dropdown selections. This is in `LandTitles.tsx` and `Register.tsx`.

Includes: Bacolod City, Bago City, Cadiz City, Escalante City, Himamaylan City, Kabankalan City, La Carlota City, Sagay City, San Carlos City, Silay City, Sipalay City, Talisay City, Victorias City, and all remaining municipalities.

---

## 13. Notes for the Next AI Agent

- Always check current file content with `read_file` before editing — files may have changed.
- Use `replace_string_in_file` with 3–5 lines of context before/after the target to prevent mismatches.
- This is a **junior developer** project (Mark). Explain what you're doing step-by-step. Don't paste code without explaining it first.
- Tailwind v4 class names differ from v3. Use native classes like `max-w-30` (not `max-w-[120px]`) and `stroke-3` (not `stroke-[3]`).
- Run `npm run build` after any significant change to verify zero TypeScript errors.
- The `ApplicationStatus` type is exported from `StatusBadge.tsx` — import it with `import type { ApplicationStatus }`.
- The `UserRole` type is exported from `AuthContext.tsx`.

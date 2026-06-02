# ARBO Mobile Support Web App — Project Context
> **For the next AI agent**: Read this entire file before making any suggestions or changes.
> Last updated: June 2, 2026

---

## 1. What Is This Project?

A **mobile-responsive web application** for the **Department of Agrarian Reform (DAR), Negros Occidental, Philippines**.

The app is called the **ARBO (Agrarian Reform Beneficiaries Organization) Support Web App**. It replaces a proposed mobile app — the client confirmed it should be a **web app that is mobile-responsive**, not a native mobile app.

The primary use case is digitizing the CLOA (Certificate of Land Ownership Award) application and approval pipeline for Agrarian Reform Beneficiaries (ARBs) — i.e., Filipino farmers.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + Vite |
| Language | TypeScript 5.5+ (strict mode) |
| Styling | Tailwind CSS v4 + PostCSS |
| Routing | React Router DOM v7 |
| Backend / Auth | Firebase v12 (Web SDK) |
| Database | Firebase Cloud Firestore (NoSQL) |
| File Storage | Firebase Storage (Base64 encoded inline in Firestore for documents) |
| Icons | Lucide React |
| Build Tool | Vite v8 |

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

- **Project ID**: `arbo-f5b2a`
- **Auth Domain**: `arbo-f5b2a.firebaseapp.com`
- **Storage Bucket**: `arbo-f5b2a.firebasestorage.app`
- **Config file**: `src/firebase/config.ts`

### Firebase Services Used
- **Firebase Authentication** — Email/Password only
- **Cloud Firestore** — Primary database
- **Firebase Storage** — Available but documents are stored as Base64 strings inside Firestore to avoid extra Storage setup

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
  "role": "arb | staff | surveyor | admin",
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
  "surveyorEncodedAt": "ISO string (optional)",
  "surveyorName": "string (optional)",
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
  "encodedBy": "string (surveyorId)",
  "encodedAt": "ISO string"
}
```

---

## 5. User Roles & Access Control

| Role | Who | Access |
|---|---|---|
| `arb` | Farmer / Beneficiary | My Application page only |
| `staff` | DAR Municipal Staff | Dashboard, Review Applications |
| `surveyor` | DAR Surveyor | Dashboard, Land Titles |
| `admin` | District Administrator | All pages including Admin Users |

Routes are protected by `ProtectedRoute.tsx` which reads the user's role from Firestore after login.

---

## 6. File Structure

```
src/
├── firebase/
│   └── config.ts              ← Firebase init, exports: auth, db, storage, firebaseConfig
├── contexts/
│   └── AuthContext.tsx         ← useAuth() hook, UserProfile type, UserRole type
├── components/
│   ├── ProtectedRoute.tsx      ← Role-based route guard
│   ├── Sidebar.tsx             ← Responsive navigation panel
│   └── StatusBadge.tsx         ← Colored status chips (exports ApplicationStatus type)
├── pages/
│   ├── Login.tsx               ← Email/Password login
│   ├── Register.tsx            ← Multi-step ARB farmer registration with doc uploads
│   ├── Dashboard.tsx           ← Admin/Staff/Surveyor stats overview
│   ├── MyApplication.tsx       ← ARB farmer view of their application
│   ├── ReviewApps.tsx          ← Staff/Admin dual-pane review board
│   ├── LandTitles.tsx          ← Surveyor GPS coordinate entry form
│   ├── Search.tsx              ← Search TCT/lot numbers/beneficiary names
│   └── AdminUsers.tsx          ← Admin creates Staff/Surveyor accounts
├── App.tsx                     ← Route definitions and role-based redirects
├── main.tsx                    ← React root entry point
└── index.css                   ← Tailwind v4 directives + global styles
```

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

### C. Base64 Document Storage
ARB farmers upload 4 documents (Cedula, Birth Cert, Barangay Cert, Photo). These are converted to Base64 strings and stored directly inside the Firestore application document. This avoids needing Firebase Storage rules and simplifies setup.

### D. Real-time Live Stats
Dashboard stats now reflect live Firestore counts for total farmers, land titles, and total hectarage. No dummy or mock data is injected. The registry table supports column sorting out of the box.

### E. CLOA Approval Pipeline (4-Stage)
1. **Under Review** (Staff Stage): ARB registers and uploads documents.
2. **Pending** (Admin Stage): Staff verifies documents and forwards to Admin.
3. **Verified**: Admin approves the application.
4. **Awarded**: Surveyor encodes the land title coordinates, generating the final CLOA.

---

## 8. Current Build Status

- **Last successful build**: June 2, 2026
- **Build command**: `npm run build`
- **Build output**: `dist/` folder
- **TypeScript errors**: 0
- **Build time**: ~4 seconds

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

    // Applications: ARB writes their own, staff/admin/surveyor can read all
    match /applications/{appId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == appId;
      allow update: if request.auth != null;
    }

    // Land Titles: surveyors and admins write, all authenticated users read
    match /landTitles/{titleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'surveyor' ||
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

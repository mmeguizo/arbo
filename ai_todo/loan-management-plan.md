# Phase 15: Loan Management System — Worker Implementation Spec

> **Status**: 📋 READY FOR WORKER
> **Created by**: Planner (2026-09-29)
> **Estimated files**: 3 new + 7 modified
> **Prerequisites**: Read `PROJECT_CONTEXT.md`, `SESSION_HANDOVER.md`, `ERD.md` first

---

## What We're Building

A complete **Loan Management System** — separate from the existing grants module. This lets:
- **ARBs** apply for individual loans, make payments, track income/expenses
- **ARBO Heads** apply for cooperative loans, verify member payments
- **Admin** approve/reject loans, set interest rates, monitor all payments, view profitability reports

The existing `loan` type in `GrantManagement.tsx` stays untouched. This is a brand new module.

---

## Quick Reference: Existing Patterns to Follow

Before you start, study these files — your code must match their patterns:

| Pattern | Reference File | What to Copy |
|---------|---------------|--------------|
| Page layout (Sidebar + content) | `src/pages/GrantManagement.tsx` lines 1–30 | Imports, layout structure |
| Firestore real-time listeners | `src/pages/GrantManagement.tsx` lines 169–220 | `onSnapshot` pattern |
| Modal forms | `src/pages/GrantManagement.tsx` lines 96–130 | State management for modals |
| Notifications | `src/contexts/NotificationContext.tsx` | `writeNotification()` usage |
| Route protection | `src/App.tsx` lines 70–85 | `<ProtectedRoute>` wrapper |
| Sidebar nav items | `src/components/Sidebar.tsx` lines 39–96 | `getNavItems()` structure |
| Base64 image handling | `src/pages/GrantManagement.tsx` | Image resize + encode |

---

## TASK LIST

Each task below is a self-contained unit of work. Do them **in order** — later tasks depend on earlier ones.

---

### TASK 1: Create Loan Types File
**File**: `src/types/loan.ts` (NEW)
**Status**: [ ]

Create this file with the exact content below. This is the foundation — all other files import from here.

```typescript
// src/types/loan.ts
// Loan Management System — Type Definitions & Utility Functions

// ─── Status Types ───────────────────────────────────────────────

export type LoanStatus =
  | "pending_approval"
  | "needs_review"
  | "active"
  | "completed"
  | "rejected"
  | "defaulted";

export type AccountStatus = "open" | "closed";

export type PaymentFrequency =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

export type PaymentStatus =
  | "upcoming"
  | "paid"
  | "overdue"
  | "partial"
  | "disputed";

// ─── Loan Document (Firestore: /loans/{loanId}) ────────────────

export interface Loan {
  id: string; // Format: "LOAN-XXXXXX" (6 random digits)

  // Applicant info
  applicantId: string; // userId (ARB uid or ARBO head uid)
  applicantName: string;
  applicantType: "individual" | "cooperative";
  cooperativeId?: string; // Only if cooperative loan
  cooperativeName?: string; // Only if cooperative loan

  // Loan details (admin sets interestRate on approval)
  principalAmount: number; // e.g., 10000
  interestRate: number; // e.g., 5 (means 5% per annum)
  termMonths: number; // e.g., 12
  paymentFrequency: PaymentFrequency;
  purpose: string; // What the loan is for

  // Calculated fields (recompute whenever admin edits terms)
  totalInterest: number;
  totalRepayment: number;
  installmentAmount: number;
  numberOfPayments: number;

  // Status
  status: LoanStatus;
  accountStatus: AccountStatus;

  // Payment tracking (updated each time a payment is confirmed)
  totalPaid: number;
  remainingBalance: number;
  defaultedPayments: number;
  onTimePayments: number;
  nextPaymentDue: string; // ISO date string

  // History flag (for re-applicants with past defaults)
  hasHistoryFlag: boolean;
  historyNotes: string; // Auto-generated: "1 previous loan, 2 defaults, ..."

  // Approval info
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  notes: string; // Admin notes

  // Metadata
  startDate?: string; // When loan becomes active (set on approval)
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// ─── Payment Document (Firestore: /loanPayments/{paymentId}) ───

export interface LoanPayment {
  id: string; // Firestore auto-ID
  loanId: string; // FK → loans.id
  applicantId: string; // FK → users.uid (for querying by user)

  // Payment details
  paymentNumber: number; // 1, 2, 3... (which installment)
  dueDate: string; // Scheduled due date (ISO)
  amountDue: number; // Scheduled installment amount
  amountPaid: number; // Actual amount paid (0 if unpaid)

  // Status
  status: PaymentStatus;
  paidAt?: string; // When payment was recorded
  paidBy?: string; // userId who recorded it
  paidByName?: string;

  // Receipt proof (REQUIRED for payment)
  receiptImage?: string; // Base64 encoded image
  receiptNotes?: string;

  // Verification by admin or ARBO head
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;

  createdAt: string;
}

// ─── Income/Expense Entry (Firestore: /loanIncomeExpenses/{id}) ─

export interface LoanIncomeExpense {
  id: string; // Firestore auto-ID
  userId: string; // FK → users.uid (the ARB)
  userName: string;

  type: "income" | "expense";
  category: string; // e.g., "Product Sale", "Fertilizer", "Labor"
  description: string; // e.g., "Sold 50kg rice at market"
  amount: number;
  date: string; // When transaction occurred (ISO)

  receiptImage?: string; // Optional base64 receipt

  createdAt: string;
  createdBy: string;
}

// ─── Predefined Categories ─────────────────────────────────────

export const INCOME_CATEGORIES = [
  "Product Sale",
  "Harvest Sale",
  "Livestock Sale",
  "Services Rendered",
  "Government Subsidy",
  "Other Income",
] as const;

export const EXPENSE_CATEGORIES = [
  "Seeds & Seedlings",
  "Fertilizer",
  "Pesticides",
  "Labor Cost",
  "Equipment Rental",
  "Transportation",
  "Loan Payment",
  "Other Expense",
] as const;

// ─── Payment Frequency Labels (for UI display) ─────────────────

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly (Every 3 months)",
  semi_annual: "Semi-Annual (Every 6 months)",
  annual: "Annual (Yearly)",
};

export const FREQUENCY_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

// ─── Loan Status Labels & Colors (for UI badges) ───────────────

export const LOAN_STATUS_CONFIG: Record<
  LoanStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending_approval: {
    label: "Pending Approval",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  needs_review: {
    label: "⚠️ Needs Review",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
  active: {
    label: "Active",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  completed: {
    label: "Completed",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  defaulted: {
    label: "Defaulted",
    color: "text-red-700",
    bgColor: "bg-red-100 border-red-300",
  },
};

export const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bgColor: string }
> = {
  upcoming: {
    label: "Upcoming",
    color: "text-slate-600",
    bgColor: "bg-slate-50 border-slate-200",
  },
  paid: {
    label: "Paid",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  overdue: {
    label: "Overdue",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  partial: {
    label: "Partial",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  disputed: {
    label: "Disputed",
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
  },
};

// ─── Utility: Generate Loan ID ─────────────────────────────────

export function generateLoanId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `LOAN-${digits}`;
}

// ─── Utility: Calculate Loan Payment Schedule ──────────────────
//
// Uses FLAT INTEREST (government microfinance standard):
//   Interest = Principal × (Rate% / 100) × (TermMonths / 12)
//   Total = Principal + Interest
//   Each Payment = Total / NumberOfPayments
//
// Returns the calculated values AND the full schedule array
// that should be written to /loanPayments/ collection.

export function calculateLoanSchedule(
  principal: number,
  interestRate: number,
  termMonths: number,
  frequency: PaymentFrequency,
  startDate: Date
): {
  totalInterest: number;
  totalRepayment: number;
  installmentAmount: number;
  numberOfPayments: number;
  schedule: { paymentNumber: number; dueDate: string; amountDue: number }[];
} {
  const termYears = termMonths / 12;
  const totalInterest =
    Math.round(principal * (interestRate / 100) * termYears * 100) / 100;
  const totalRepayment = principal + totalInterest;

  // How many payments based on frequency
  const monthsPerPayment = FREQUENCY_MONTHS[frequency];
  const numberOfPayments = Math.ceil(termMonths / monthsPerPayment);
  const installmentAmount =
    Math.round((totalRepayment / numberOfPayments) * 100) / 100;

  // Generate schedule with due dates
  const schedule: {
    paymentNumber: number;
    dueDate: string;
    amountDue: number;
  }[] = [];
  for (let i = 0; i < numberOfPayments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i + 1) * monthsPerPayment);

    // Last payment gets the remainder to avoid rounding issues
    const isLast = i === numberOfPayments - 1;
    const amountDue = isLast
      ? Math.round(
          (totalRepayment - installmentAmount * (numberOfPayments - 1)) * 100
        ) / 100
      : installmentAmount;

    schedule.push({
      paymentNumber: i + 1,
      dueDate: dueDate.toISOString(),
      amountDue,
    });
  }

  return {
    totalInterest,
    totalRepayment,
    installmentAmount,
    numberOfPayments,
    schedule,
  };
}

// ─── Utility: Check if a user has past loan defaults ───────────
//
// Pass in all loans for a user. Returns summary for the history flag.

export function checkLoanHistory(pastLoans: Loan[]): {
  hasDefaults: boolean;
  totalLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  totalDefaultedPayments: number;
  historyNotes: string;
} {
  const totalLoans = pastLoans.length;
  const completedLoans = pastLoans.filter(
    (l) => l.status === "completed"
  ).length;
  const defaultedLoans = pastLoans.filter(
    (l) => l.status === "defaulted"
  ).length;
  const totalDefaultedPayments = pastLoans.reduce(
    (sum, l) => sum + (l.defaultedPayments || 0),
    0
  );
  const hasDefaults = totalDefaultedPayments > 0 || defaultedLoans > 0;

  let historyNotes = `${totalLoans} previous loan(s)`;
  if (completedLoans > 0) historyNotes += `, ${completedLoans} completed`;
  if (defaultedLoans > 0) historyNotes += `, ${defaultedLoans} defaulted`;
  if (totalDefaultedPayments > 0)
    historyNotes += `, ${totalDefaultedPayments} missed payment(s)`;
  if (!hasDefaults && totalLoans > 0) historyNotes += " — clean record ✓";

  return {
    hasDefaults,
    totalLoans,
    completedLoans,
    defaultedLoans,
    totalDefaultedPayments,
    historyNotes,
  };
}
```

**Verification**: File should have zero import errors. Run `npm run build` — it should compile without issues since this file has no external dependencies (only exports).

---

### TASK 2: Extend Notification Types
**File**: `src/contexts/NotificationContext.tsx` (MODIFY)
**Status**: [ ]

Find the `type` union in the `Notification` interface (around line 26–38). Add the loan notification types.

**Find this exact code** (around line 26–38):
```typescript
  type:
    | "submitted"
    | "forwarded"
    | "encoded"
    | "awarded"
    | "disputed"
    | "correction_needed"
    | "correction_resolved"
    | "blocked"
    | "training_assigned"
    | "training_reminder"
    | "training_acknowledged"
    | "password_reset_requested";
```

**Replace with**:
```typescript
  type:
    | "submitted"
    | "forwarded"
    | "encoded"
    | "awarded"
    | "disputed"
    | "correction_needed"
    | "correction_resolved"
    | "blocked"
    | "training_assigned"
    | "training_reminder"
    | "training_acknowledged"
    | "password_reset_requested"
    | "loan_submitted"
    | "loan_approved"
    | "loan_rejected"
    | "payment_due_soon"
    | "payment_overdue"
    | "payment_received"
    | "payment_verified"
    | "payment_disputed"
    | "loan_completed"
    | "loan_defaulted";
```

**That's the only change to this file.** Don't touch anything else.

---

### TASK 3: Add Routes to App.tsx
**File**: `src/App.tsx` (MODIFY)
**Status**: [ ]

**Step 3a**: Add imports at the top of the file. Find the imports section (around lines 12–28) and add these two lines after the last import:

```typescript
import { LoanApplication } from "./pages/LoanApplication";
import { LoanManagement } from "./pages/LoanManagement";
```

**Step 3b**: Add routes. Find the `{/* Wildcard Fallback redirection */}` comment (around line 204). Add these two route blocks BEFORE that comment:

```tsx
            <Route
              path="/my-loans"
              element={
                <ProtectedRoute allowedRoles={["arb", "arbo_head"]}>
                  <LoanApplication />
                </ProtectedRoute>
              }
            />

            <Route
              path="/loan-management"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <LoanManagement />
                </ProtectedRoute>
              }
            />
```

> **NOTE**: This will cause TypeScript errors until you create `LoanApplication.tsx` and `LoanManagement.tsx` in tasks 5 and 6. That's expected — complete tasks 5 and 6 before running `npm run build`.

---

### TASK 4: Add Sidebar Navigation Items
**File**: `src/components/Sidebar.tsx` (MODIFY)
**Status**: [ ]

**Step 4a**: Add the `Landmark` icon import. Find the import block from lucide-react (around line 5–19). Add `Landmark` to the import list:

```typescript
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  TrendingUp,
  ClipboardList,
  Building2,
  GraduationCap,
  Landmark,        // ← ADD THIS
} from "lucide-react";
```

**Step 4b**: Add nav item for ARB role. Find the `arb` nav items array (around line 42–48). Add after `My Trainings`:

```typescript
    if (role === "arb") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "My CLOA Record", path: "/my-application", icon: FileText },
        { label: "My Grants", path: "/my-grants", icon: TrendingUp },
        { label: "My Trainings", path: "/my-trainings", icon: GraduationCap },
        { label: "My Loans", path: "/my-loans", icon: Landmark },           // ← ADD THIS
      ];
    }
```

**Step 4c**: Add nav item for ARBO Head role. Find the `arbo_head` nav items (around line 51–58). Add after `My Trainings`:

```typescript
    if (role === "arbo_head") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "ARBO Dashboard", path: "/arbo-dashboard", icon: Building2 },
        { label: "My CLOA Record", path: "/my-application", icon: FileText },
        { label: "My Grants", path: "/my-grants", icon: TrendingUp },
        { label: "My Trainings", path: "/my-trainings", icon: GraduationCap },
        { label: "My Loans", path: "/my-loans", icon: Landmark },           // ← ADD THIS
      ];
    }
```

**Step 4d**: Add nav item for Admin role. Find the admin nav items (around line 79–91). Add AFTER `Grant Management` and BEFORE `Trainings`:

```typescript
        { label: "Grant Management", path: "/grants", icon: TrendingUp },
        { label: "Loan Management", path: "/loan-management", icon: Landmark },  // ← ADD THIS
        { label: "Trainings", path: "/trainings", icon: GraduationCap },
```

---

### TASK 5: Create LoanApplication Page (ARB / ARBO Head)
**File**: `src/pages/LoanApplication.tsx` (NEW)
**Status**: [ ]

This is a BIG file. Create it with these sections. Follow the patterns from `GrantManagement.tsx`.

**Page structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ <Sidebar />  │  Main Content Area                            │
│              │                                                │
│              │  📊 Summary Cards Row (4 cards)                │
│              │  ┌────────┐┌────────┐┌────────┐┌────────┐    │
│              │  │Active  ││Outstand││Next Due││Net     │    │
│              │  │Loans   ││Balance ││Date    ││Profit  │    │
│              │  └────────┘└────────┘└────────┘└────────┘    │
│              │                                                │
│              │  [My Loans] [Income & Expenses] tabs           │
│              │                                                │
│              │  Tab 1: My Loans                               │
│              │  ┌──────────────────────────────────────────┐  │
│              │  │ Each loan row:                           │  │
│              │  │   Loan ID, Amount, Status, Balance       │  │
│              │  │   [▼ Expand] shows payment schedule      │  │
│              │  │   [Make Payment] opens payment modal     │  │
│              │  └──────────────────────────────────────────┘  │
│              │                          [+ Apply for Loan]    │
│              │                                                │
│              │  Tab 2: Income & Expenses                      │
│              │  ┌──────────────────────────────────────────┐  │
│              │  │ Income: ₱XX,XXX  Expenses: ₱XX,XXX      │  │
│              │  │ Net: ₱XX,XXX (green if positive)        │  │
│              │  │                                          │  │
│              │  │ [+ Add Income] [+ Add Expense]          │  │
│              │  │                                          │  │
│              │  │ Table of all entries                     │  │
│              │  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Required functionality in this file**:

1. **Imports**: React, useState, useEffect, useMemo, useAuth, Sidebar, Firestore (collection, query, where, addDoc, onSnapshot, updateDoc, doc), formatDate, lucide icons (Landmark, Plus, X, Eye, ChevronDown, ChevronUp, Upload, DollarSign, TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle), and all types from `../types/loan`

2. **State variables**:
   - `loans: Loan[]` — All loans for this user (queried by `applicantId === profile.uid`)
   - `payments: LoanPayment[]` — All payments for this user's loans
   - `incomeExpenses: LoanIncomeExpense[]` — All income/expense entries for this user
   - `loading: boolean`
   - `activeTab: 'loans' | 'income_expenses'`
   - `expandedLoan: string | null` — Which loan's schedule is expanded
   - `showApplyModal: boolean`
   - `showPaymentModal: boolean` + `paymentForLoan: string | null` + `paymentForEntry: LoanPayment | null`
   - `showIncomeExpenseModal: boolean` + `incomeExpenseType: 'income' | 'expense'`
   - Form state for apply modal: `formPurpose, formAmount, formTerm, formFrequency`
   - Form state for payment modal: `payAmount, payReceiptImage, payNotes`
   - Form state for income/expense: `ieCategory, ieDescription, ieAmount, ieDate, ieReceipt`

3. **Firestore listeners** (in `useEffect`):
   - Listen to `/loans` where `applicantId == profile.uid`
   - Listen to `/loanPayments` where `applicantId == profile.uid`
   - Listen to `/loanIncomeExpenses` where `userId == profile.uid`
   - All with `onSnapshot` for real-time updates

4. **Payment due notification check** (in `useEffect`, runs once on load):
   - For each active loan's payments that are `upcoming` and `dueDate` is within 7 days: write a `payment_due_soon` notification if one doesn't already exist for that payment
   - For each payment that is `upcoming` and `dueDate` is in the past: update status to `overdue` and write a `payment_overdue` notification

5. **Apply for Loan handler**:
   - Generate loan ID with `generateLoanId()`
   - Query existing loans for this user to check history with `checkLoanHistory()`
   - Create loan doc in `/loans` with status `pending_approval` (or `needs_review` if `hasDefaults`)
   - Interest rate is set to 0 initially (admin sets it on approval)
   - Write notification to admin: type `loan_submitted`
   - If ARBO head, add `applicantType: 'cooperative'` + cooperativeId/Name from profile

6. **Make Payment handler**:
   - Require receipt image (validate before submit)
   - Resize image to 600px max, 0.6 quality (use same pattern as document uploads in `Register.tsx` or `GrantManagement.tsx`)
   - Update the `loanPayments` doc: set `amountPaid`, `paidAt`, `paidBy`, `paidByName`, `receiptImage`, `receiptNotes`, `status: 'paid'`
   - Update parent `/loans` doc: increment `totalPaid`, decrement `remainingBalance`, increment `onTimePayments`, update `nextPaymentDue` to next upcoming payment
   - Write notification: type `payment_received` to admin

7. **Add Income/Expense handler**:
   - Add doc to `/loanIncomeExpenses` with all fields
   - If type is `expense` and category is `Loan Payment`, also check if it corresponds to an actual loan payment

8. **Computed values** (useMemo):
   - `activeLoansCount` — loans where status is `active`
   - `totalOutstanding` — sum of `remainingBalance` for active loans
   - `nextDueDate` — earliest `nextPaymentDue` across active loans
   - `totalIncome` — sum of all income entries
   - `totalExpenses` — sum of all expense entries
   - `netProfit` — totalIncome - totalExpenses

9. **UI render**: Follow the layout above. Use Tailwind classes matching the existing app style (emerald/slate/amber color scheme, rounded-xl cards, etc.)

**IMPORTANT PATTERNS TO FOLLOW** (copy from `GrantManagement.tsx`):
- Page wrapper: `<div className="flex h-screen bg-slate-50"><Sidebar /><main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">...</main></div>`
- Card style: `<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">...</div>`
- Modal: fixed overlay with white card, X close button, form fields with Tailwind styling
- Button style: `className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 text-sm font-medium"`

---

### TASK 6: Create LoanManagement Page (Admin)
**File**: `src/pages/LoanManagement.tsx` (NEW)
**Status**: [ ]

This is the LARGEST file. Admin-only dashboard for managing all loans in the system.

**Page structure**:
```
┌──────────────────────────────────────────────────────────────────┐
│ <Sidebar />  │  Main Content Area                                │
│              │                                                    │
│              │  🏦 Loan Management (page title)                   │
│              │                                                    │
│              │  KPI Cards Row (5 cards)                           │
│              │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐       │
│              │  │Total ││Deploy││Outst ││Active││Rate  │       │
│              │  │Loans ││₱     ││₱     ││Count ││%     │       │
│              │  └──────┘└──────┘└──────┘└──────┘└──────┘       │
│              │                                                    │
│              │  [Pending] [Active] [Payments] [Defaults]          │
│              │  [Profitability] [Completed]                       │
│              │                                                    │
│              │  (Tab content changes based on selection)          │
└──────────────────────────────────────────────────────────────────┘
```

**Required functionality**:

1. **Firestore listeners**:
   - ALL loans: `onSnapshot(collection(db, "loans"), orderBy("createdAt", "desc"))`
   - ALL payments: `onSnapshot(collection(db, "loanPayments"))` 
   - ALL income/expenses: `onSnapshot(collection(db, "loanIncomeExpenses"))`
   - ALL users (ARBs): `onSnapshot(query(collection(db, "users"), where("role", "in", ["arb", "arbo_head"])))`

2. **KPI cards** (computed from loans data):
   - **Total Loans Issued**: `loans.length`
   - **Capital Deployed**: sum of `principalAmount` for all non-rejected loans
   - **Outstanding Balance**: sum of `remainingBalance` for active loans
   - **Active Loans**: count where `status === 'active'`
   - **Collection Rate**: `(totalOnTimePayments / totalExpectedPayments) * 100`%

3. **Tab: Pending Approval** (loans where `status === 'pending_approval' || status === 'needs_review'`):
   - List each pending loan as a card
   - Show: applicant name, amount requested, purpose, term, frequency
   - If `hasHistoryFlag === true`: show orange ⚠️ warning box with `historyNotes`
   - **Approve form**: admin enters interest rate % → system calls `calculateLoanSchedule()` → shows preview of payment schedule → "Approve & Activate" button
   - On approve:
     - Update loan doc: set `status: 'active'`, `interestRate`, all calculated fields, `approvedBy/Name/At`, `startDate`, `accountStatus: 'open'`
     - Create all payment docs in `/loanPayments` from the schedule (status: 'upcoming')
     - Write notification to applicant: type `loan_approved`
   - **Reject button**: requires reason text → update loan `status: 'rejected'`, `rejectedReason` → notify applicant `loan_rejected`

4. **Tab: Active Loans** (loans where `status === 'active'`):
   - Table: Borrower, Principal, Balance, Interest %, Next Due, Default Count, Status
   - Search/filter by borrower name
   - Click row to expand: show full payment schedule, each payment's status, receipt thumbnails
   - Admin can edit loan terms:
     - Modal to change interest rate or term
     - Recalculate schedule with `calculateLoanSchedule()`
     - Update loan doc + recreate payment schedule (only for future unpaid payments)
   - Admin can manually close/default a loan

5. **Tab: Payment Tracking** (all recent payments with `status === 'paid'` that haven't been verified):
   - Table: Date, Borrower, Loan ID, Amount, Receipt thumbnail
   - Click receipt thumbnail to view full-size image in modal
   - "Verify" button → updates payment `verifiedBy/Name/At` → notifies ARB `payment_verified`
   - "Dispute" button → sets payment `status: 'disputed'` → notifies ARB `payment_disputed`

6. **Tab: Defaulters** (loans with `defaultedPayments > 0` or payments with `status === 'overdue'`):
   - Table: Borrower, Loan ID, Overdue Since, Amount Overdue, Total Defaults
   - "Send Reminder" button → writes `payment_overdue` notification to the ARB
   - "Mark as Defaulted" → sets loan `status: 'defaulted'`, `accountStatus: 'closed'`

7. **Tab: Profitability** (aggregated view of all ARB income/expenses):
   - Summary cards: Total ARB Income, Total ARB Expenses, Net Profit/Loss
   - Table per ARB: Name, Total Income, Total Expenses, Net Profit, Active Loan Balance
   - Sort by net profit (ascending = worst performing first)
   - Export to CSV button using `exportToCSV()` from `src/utils/formatters.ts`

8. **Tab: Completed/Closed** (loans where `status === 'completed' || status === 'defaulted' || status === 'rejected'`):
   - Archive table: Borrower, Loan ID, Original Amount, Status, Completion Date
   - Read-only — click to view full history

**IMPORTANT PATTERNS**:
- Use the same tab UI pattern as `ReviewApps.tsx` or `GrantManagement.tsx`
- Tab buttons: `className={activeTab === 'pending' ? 'bg-emerald-700 text-white ...' : 'bg-white text-slate-600 hover:bg-slate-100 ...'}`
- Use `useMemo` for filtered/computed lists to avoid re-renders
- Page wrapper same as Task 5

---

### TASK 7: Extend ARBO Head Dashboard
**File**: `src/pages/ArboDashboard.tsx` (MODIFY)
**Status**: [ ]

The ARBO Head Dashboard already has a "Loans" tab. You need to enhance it with real data from the new `/loans` and `/loanPayments` collections.

**What to add to the existing "Loans" tab**:

1. Add imports for loan types: `import { Loan, LoanPayment, LOAN_STATUS_CONFIG } from "../types/loan";`

2. Add state: `const [coopLoans, setCoopLoans] = useState<Loan[]>([]);` and `const [coopPayments, setCoopPayments] = useState<LoanPayment[]>([]);`

3. Add Firestore listener: query `/loans` where `cooperativeId == profile.arboId` (the ARBO head's cooperative)

4. Add Firestore listener: query `/loanPayments` for all loans in `coopLoans` 

5. Replace the Loans tab content with:
   - Summary: Total coop loans, total outstanding, total collected
   - Table of coop member loans: Member Name, Loan Amount, Balance, Status, Next Due
   - Click to expand: show payment history with receipt images
   - "Apply Cooperative Loan" button → redirects to `/my-loans` page
   - Payment verification: ARBO head can verify coop member payments (same logic as admin in Task 6, step 5)

**Be careful**: Read the existing `ArboDashboard.tsx` file first. It already has tabs and state. You're only modifying the Loans tab content and adding the new state/listeners. Don't break the existing Members, Trainings, Grants, or Admin Notes tabs.

---

### TASK 8: Update ERD Documentation
**File**: `ERD.md` (MODIFY)
**Status**: [ ]

**Step 8a**: Add relationships to the Mermaid `erDiagram` block. Find the existing relationships section and add:

```
    USERS ||--o{ LOANS : "applicantId → uid"
    COOPERATIVES ||--o{ LOANS : "cooperativeId → id"
    LOANS ||--o{ LOAN_PAYMENTS : "loanId → id"
    USERS ||--o{ LOAN_INCOME_EXPENSES : "userId → uid"
```

**Step 8b**: Add entity definitions inside the `erDiagram` block:

```
    LOANS {
        string id PK "LOAN-XXXXXX"
        string applicantId FK "→ users.uid"
        string applicantName
        string applicantType "individual | cooperative"
        string cooperativeId FK "→ cooperatives.id (nullable)"
        number principalAmount
        number interestRate
        number termMonths
        string paymentFrequency "monthly | quarterly | semi_annual | annual"
        string purpose
        number totalInterest
        number totalRepayment
        number installmentAmount
        number numberOfPayments
        string status "pending_approval | needs_review | active | completed | rejected | defaulted"
        string accountStatus "open | closed"
        number totalPaid
        number remainingBalance
        number defaultedPayments
        number onTimePayments
        string nextPaymentDue
        boolean hasHistoryFlag
        string historyNotes
        string approvedBy
        string startDate
        string createdAt
        string createdBy
    }

    LOAN_PAYMENTS {
        string id PK "auto-ID"
        string loanId FK "→ loans.id"
        string applicantId FK "→ users.uid"
        number paymentNumber
        string dueDate
        number amountDue
        number amountPaid
        string status "upcoming | paid | overdue | partial | disputed"
        string paidAt
        string receiptImage "base64"
        string verifiedBy
        string verifiedAt
        string createdAt
    }

    LOAN_INCOME_EXPENSES {
        string id PK "auto-ID"
        string userId FK "→ users.uid"
        string userName
        string type "income | expense"
        string category
        string description
        number amount
        string date
        string receiptImage "base64 (nullable)"
        string createdAt
        string createdBy
    }
```

**Step 8c**: Add to the relationships summary table:

```
| 17  | **users**        | **loans**              | 1 → many | `loans.applicantId` = `users.uid`                  |
| 18  | **cooperatives** | **loans**              | 1 → many | `loans.cooperativeId` = `cooperatives.id`           |
| 19  | **loans**        | **loanPayments**       | 1 → many | `loanPayments.loanId` = `loans.id`                  |
| 20  | **users**        | **loanIncomeExpenses** | 1 → many | `loanIncomeExpenses.userId` = `users.uid`            |
```

**Step 8d**: Add collection details section:

```markdown
### `/loans/{loanId}`

- Full lifecycle loan management — application through completion.
- Status drives the approval and payment workflow.
- `hasHistoryFlag` is auto-set when applicant has past defaults.
- Interest rate is set by admin during approval (starts at 0).

### `/loanPayments/{paymentId}`

- One document per scheduled installment.
- Created in batch when admin approves a loan.
- Receipt images stored as Base64 (required for payment).
- Can be verified by admin or ARBO head.

### `/loanIncomeExpenses/{entryId}`

- Simple income/expense ledger per ARB.
- Categories from predefined lists (Product Sale, Fertilizer, etc.).
- Used for profitability reporting across all ARBs.
```

---

### TASK 9: Update PROJECT_TASKS.md
**File**: `PROJECT_TASKS.md` (MODIFY)
**Status**: [ ]

Add this section before the `## Discovered Issues / Future` section:

```markdown
## Phase 15: Loan Management System (2026-09-29)

### Foundation
- [ ] 15.1 Create `src/types/loan.ts` — Interfaces, utility functions, calculateLoanSchedule
- [ ] 15.2 Extend `NotificationContext.tsx` — Add 10 loan notification types

### Navigation & Routing
- [ ] 15.3 `App.tsx` — Add `/my-loans` and `/loan-management` routes
- [ ] 15.4 `Sidebar.tsx` — Add nav items for arb, arbo_head, admin

### ARB/ARBO Head Pages
- [ ] 15.5 Create `LoanApplication.tsx` — Loan list, apply form, payment schedule view
- [ ] 15.6 `LoanApplication.tsx` — Payment modal with receipt upload
- [ ] 15.7 `LoanApplication.tsx` — Income & Expenses ledger tab
- [ ] 15.8 `LoanApplication.tsx` — Payment due notification check on load

### Admin Pages
- [ ] 15.9 Create `LoanManagement.tsx` — KPI cards, tab structure
- [ ] 15.10 `LoanManagement.tsx` — Pending Approval tab with history flagging
- [ ] 15.11 `LoanManagement.tsx` — Active Loans tab with payment tracking
- [ ] 15.12 `LoanManagement.tsx` — Payment Tracking tab with receipt verification
- [ ] 15.13 `LoanManagement.tsx` — Defaulters tab with reminders
- [ ] 15.14 `LoanManagement.tsx` — Profitability tab with CSV export
- [ ] 15.15 `LoanManagement.tsx` — Completed/Closed tab

### ARBO Head Enhancements
- [ ] 15.16 `ArboDashboard.tsx` — Enhance Loans tab with real coop loan data
- [ ] 15.17 `ArboDashboard.tsx` — ARBO head can verify coop member payments

### Documentation
- [ ] 15.18 Update `ERD.md` — Add 3 new collections
- [ ] 15.19 Update `PROJECT_CONTEXT.md` — Document loan module
- [ ] 15.20 Update `SESSION_HANDOVER.md` — Document loan module

### Verification
- [ ] 15.21 `npm run build` passes with 0 TypeScript errors
- [ ] 15.22 Manual test: ARB apply → Admin approve → ARB pay → Admin verify
```

---

### TASK 10: Update PROJECT_CONTEXT.md and SESSION_HANDOVER.md
**File**: `PROJECT_CONTEXT.md` (MODIFY) + `SESSION_HANDOVER.md` (MODIFY)
**Status**: [ ]

**In `PROJECT_CONTEXT.md`**:

- In section "6. File Structure", add under `├── pages/`:
  ```
  │   ├── LoanApplication.tsx   ← ARB/ARBO head loan application & payment tracking
  │   ├── LoanManagement.tsx    ← Admin loan management dashboard
  ```

- In section "7. Key Architecture Decisions", replace the "No Microfinance" note:
  ```
  ### B. Loan Management Module (Added Sep 2026)
  
  Full lifecycle loan management with separate Firestore collections (`/loans/`, `/loanPayments/`, `/loanIncomeExpenses/`). Uses flat interest rate calculation. Payment receipts stored as Base64. Admin sets interest rate during approval. Past defaulters are auto-flagged on re-application.
  ```

**In `SESSION_HANDOVER.md`**:

- In section "6. Files & Their Responsibilities", add to the Pages table:
  ```
  | `LoanApplication.tsx` | arb/arbo_head | Apply for loans, make payments, track income/expenses |
  | `LoanManagement.tsx`  | admin         | Approve loans, monitor payments, profitability reports |
  ```

- In section "7. What Has Been Built", add:
  ```
  - ✅ **Loan Management**: Full loan lifecycle — apply, approve (with interest rate), auto-calculated payment schedules (monthly/quarterly/semi-annual/annual), payment tracking with receipt photos, income/expense ledger, profitability reporting, defaulter detection with history flagging on re-application
  ```

- In section "4. Firestore Collections", add the 3 new collection schemas (copy from TASK 1's interfaces, formatted as JSON like the existing collections)

---

## VERIFICATION CHECKLIST

After completing ALL tasks, verify:

- [ ] `npm run build` passes with **0 TypeScript errors**
- [ ] All 3 new files exist: `src/types/loan.ts`, `src/pages/LoanApplication.tsx`, `src/pages/LoanManagement.tsx`
- [ ] Sidebar shows "My Loans" for ARB and ARBO Head roles
- [ ] Sidebar shows "Loan Management" for Admin role
- [ ] Routes `/my-loans` and `/loan-management` are protected by correct roles
- [ ] `NotificationContext.tsx` has all 10 new notification types
- [ ] `ERD.md` has all 3 new collections
- [ ] `PROJECT_TASKS.md` has Phase 15 tasks

---

## IMPORTANT REMINDERS FOR WORKER

1. **Follow existing code style** — Look at `GrantManagement.tsx` for the exact patterns (imports, layout, Firestore queries, modals, forms)
2. **Tailwind v4** — Use native classes like `max-w-30`, NOT arbitrary values like `max-w-[120px]`
3. **Base64 images** — Resize to 600px max dimension, 0.6 JPEG quality before encoding. See `Register.tsx` for the resize function
4. **Firestore** — Use `onSnapshot` for real-time listeners, NOT `getDocs`. Always clean up listeners in useEffect return
5. **Notifications** — Use `writeNotification()` from `useNotifications()` hook for targeted notifications, or `broadcastNotification()` for role-wide alerts
6. **Date format** — Use `formatDate()` from `src/utils/formatters.ts` for all displayed dates
7. **IDs** — Loan IDs use format `LOAN-XXXXXX` (6 digits). Use `generateLoanId()` from `src/types/loan.ts`
8. **Run `npm run build` after EVERY significant change** — Don't wait until the end
9. **Don't break existing features** — Only modify the specific lines mentioned in each task

## IMPLEMENTATION ADDENDUM

- Cooperative rejected-loan resubmission is handled in the ARBO Dashboard
  cooperative-loan modal. It updates the original loan, preserves member
  allocations, requires correction notes, and keeps the My Loans resubmission
  flow for individual loans.
- The applicant income/expense ledger supports selecting all loans, one
  individual loan, or one cooperative loan. New entries inherit the selected
  loan through the optional `loanId` field, and loan-payment expenses must
  match a payment from that selected loan.
10. **Export all page components** — Use `export const LoanApplication: React.FC = () => { ... }` (named export, not default)

# Phase 16: Sidebar Reorganization, Beneficiary Monitor & Mobile Fix — Worker Spec

> **Status**: 📋 READY FOR WORKER
> **Created by**: Planner (2026-09-29)
> **Problem**: Admin sidebar has 11 flat items — confusing. No central monitoring page. Mobile view broken.
> **Prerequisites**: Read `PROJECT_CONTEXT.md`, `SESSION_HANDOVER.md`, `GEMINI.md`, and study `Sidebar.tsx`

---

## What We're Building

Three major changes:

1. **Sidebar Reorganization** — Group admin's 11 flat items into 5 collapsible sections
2. **Beneficiary Monitor** — New "360° view" page: click any ARB and see ALL their data (CLOA, loans, payments, grants, income/expenses, trainings) on one page
3. **Mobile Layout Fix** — Fix broken mobile views across all pages

---

## CURRENT vs. NEW Sidebar (Admin Role)

### BEFORE (11 flat items — confusing):
```
Overview
Review (Staff Stage)
Encoder Stage
Search Registry
Analytics & Reports
Grant Management
Loan Management
Trainings
ARBOs
System Users
Audit Logs
```

### AFTER (5 grouped sections — organized):
```
📊 Overview                          ← standalone (no group)

📋 Land Title Verification           ← collapsible group header
   ├── Review Applications
   ├── Encoder Stage
   └── Search Registry

💰 Microfinance                      ← collapsible group header
   ├── Grant Management
   └── Loan Management

📈 Profitability Tracking            ← collapsible group header
   ├── Beneficiary Monitor           ← NEW PAGE
   ├── Trainings
   ├── ARBOs
   ├── Farm Monitoring               ← NEW PAGE
   └── Analytics & Reports

⚙️ System                            ← collapsible group header
   ├── System Users
   └── Audit Logs
```

### Staff sidebar (minor reorganization):
```
📊 Overview

📋 Land Title Verification
   ├── Review Applications
   └── Search Registry

⚙️ System
   └── Audit Logs
```

### Encoder sidebar (minor reorganization):
```
📊 Overview

📋 Land Title Verification
   ├── Encode Title Info
   └── Search Registry

⚙️ System
   └── Audit Logs
```

### ARB sidebar (NO CHANGE — stays flat):
```
Overview
My CLOA Record
My Grants
My Trainings
My Loans
```

### ARBO Head sidebar (NO CHANGE — stays flat):
```
Overview
ARBO Dashboard
My CLOA Record
My Grants
My Trainings
My Loans
```

---

## TASK LIST

---

### TASK 1: Rewrite Sidebar with Collapsible Groups
**File**: `src/components/Sidebar.tsx` (REWRITE)
**Status**: [ ]

This is the biggest change. The Sidebar currently has a flat list of `{ label, path, icon }` items. We need to support **grouped items with collapsible headers**.

**New data structure**:

```typescript
// A nav item is either a direct link OR a group with children
interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

// Type guard
function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}
```

**Collapse state**: Use `useState<Record<string, boolean>>` to track which groups are open. Default ALL groups open. Store by group label as key.

**Active state for groups**: A group header should be highlighted if ANY of its children's paths match the current `location.pathname`.

**New icon imports needed** (add to lucide-react import):
```typescript
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,    // ADD — for group expand indicator
  Menu,
  X,
  TrendingUp,
  ClipboardList,
  Building2,
  GraduationCap,
  Landmark,
  DollarSign,      // ADD — for Microfinance group icon
  BarChart3,       // ADD — for Profitability group icon
  Shield,          // ADD — for Land Title Verification group icon
  Cog,             // ADD — for System group icon
  UserSearch,      // ADD — for Beneficiary Monitor
  Tractor,         // ADD — for Farm Monitoring
} from "lucide-react";
```

**Updated `getNavItems()` — returns `NavEntry[]`**:

```typescript
const getNavItems = (): NavEntry[] => {
  const role = profile?.role;

  if (role === "arb") {
    return [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { label: "My CLOA Record", path: "/my-application", icon: FileText },
      { label: "My Grants", path: "/my-grants", icon: TrendingUp },
      { label: "My Trainings", path: "/my-trainings", icon: GraduationCap },
      { label: "My Loans", path: "/my-loans", icon: Landmark },
    ];
  }

  if (role === "arbo_head") {
    return [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      { label: "ARBO Dashboard", path: "/arbo-dashboard", icon: Building2 },
      { label: "My CLOA Record", path: "/my-application", icon: FileText },
      { label: "My Grants", path: "/my-grants", icon: TrendingUp },
      { label: "My Trainings", path: "/my-trainings", icon: GraduationCap },
      { label: "My Loans", path: "/my-loans", icon: Landmark },
    ];
  }

  if (role === "staff") {
    return [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      {
        label: "Land Title Verification",
        icon: Shield,
        children: [
          { label: "Review Applications", path: "/review-apps", icon: FileText },
          { label: "Search Registry", path: "/search", icon: Search },
        ],
      },
      {
        label: "System",
        icon: Cog,
        children: [
          { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
        ],
      },
    ];
  }

  if (role === "encoder") {
    return [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      {
        label: "Land Title Verification",
        icon: Shield,
        children: [
          { label: "Encode Title Info", path: "/land-titles", icon: MapPin },
          { label: "Search Registry", path: "/search", icon: Search },
        ],
      },
      {
        label: "System",
        icon: Cog,
        children: [
          { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
        ],
      },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
      {
        label: "Land Title Verification",
        icon: Shield,
        children: [
          { label: "Review Applications", path: "/review-apps", icon: FileText },
          { label: "Encoder Stage", path: "/land-titles", icon: MapPin },
          { label: "Search Registry", path: "/search", icon: Search },
        ],
      },
      {
        label: "Microfinance",
        icon: DollarSign,
        children: [
          { label: "Grant Management", path: "/grants", icon: TrendingUp },
          { label: "Loan Management", path: "/loan-management", icon: Landmark },
        ],
      },
      {
        label: "Profitability Tracking",
        icon: BarChart3,
        children: [
          { label: "Beneficiary Monitor", path: "/beneficiary-monitor", icon: UserSearch },
          { label: "Trainings", path: "/trainings", icon: GraduationCap },
          { label: "ARBOs", path: "/cooperatives", icon: Building2 },
          { label: "Farm Monitoring", path: "/farm-monitoring", icon: Tractor },
          { label: "Analytics & Reports", path: "/reports", icon: TrendingUp },
        ],
      },
      {
        label: "System",
        icon: Cog,
        children: [
          { label: "System Users", path: "/accounts", icon: Settings },
          { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
        ],
      },
    ];
  }

  return [];
};
```

**Updated render for the navigation section**. Replace the current `<nav>` block with:

```tsx
<nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
  {navItems.map((entry) => {
    if (isNavGroup(entry)) {
      const isGroupActive = entry.children.some((child) => isActive(child.path));
      const isGroupOpen = openGroups[entry.label] !== false; // default open
      const GroupIcon = entry.icon;
      return (
        <div key={entry.label} className="mb-1">
          {/* Group header — clickable to toggle */}
          <button
            onClick={() =>
              setOpenGroups((prev) => ({
                ...prev,
                [entry.label]: !isGroupOpen,
              }))
            }
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              isGroupActive
                ? "text-amber-300"
                : "text-emerald-300/70 hover:text-emerald-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <GroupIcon size={14} />
              <span>{entry.label}</span>
            </div>
            <ChevronDown
              size={12}
              className={`transition-transform ${isGroupOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {/* Children — collapsible */}
          {isGroupOpen && (
            <div className="ml-3 space-y-0.5 border-l border-emerald-700/50 pl-2">
              {entry.children.map((child) => {
                const ChildIcon = child.icon;
                const childActive = isActive(child.path);
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      childActive
                        ? "bg-emerald-700 text-white font-semibold"
                        : "text-emerald-100/80 hover:bg-emerald-800/50 hover:text-white"
                    }`}
                  >
                    <ChildIcon
                      size={15}
                      className={
                        childActive
                          ? "text-amber-400"
                          : "text-emerald-300/60"
                      }
                    />
                    <span>{child.label}</span>
                    {childActive && (
                      <ChevronRight size={12} className="ml-auto text-amber-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Flat item (no group) — same render as before
    const Icon = entry.icon;
    const active = isActive(entry.path);
    return (
      <Link
        key={entry.path}
        to={entry.path}
        onClick={() => setIsOpen(false)}
        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-emerald-700 text-white font-semibold"
            : "text-emerald-100 hover:bg-emerald-800/50 hover:text-white"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Icon
            size={18}
            className={
              active
                ? "text-amber-400"
                : "text-emerald-200 group-hover:text-amber-300"
            }
          />
          <span>{entry.label}</span>
        </div>
        {active && <ChevronRight size={14} className="text-amber-400" />}
      </Link>
    );
  })}
</nav>
```

**State to add** at the top of the component:
```typescript
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
```

**IMPORTANT**: Keep EVERYTHING else in the Sidebar the same — the header logo, the footer user info + logout, the mobile backdrop, the mobile top header. Only the nav items structure and render change.

---

### TASK 2: Create Beneficiary Monitor Page
**File**: `src/pages/BeneficiaryMonitor.tsx` (NEW)
**Status**: [ ]

A new **admin-only** page that shows a searchable list of all ARBs, and when you click one, shows their **complete 360° profile**:

**Page structure**:
```
┌───────────────────────────────────────────────────────────┐
│ <Sidebar /> │  Beneficiary Monitor                        │
│             │                                             │
│             │  [Search: ___________] [Filter: All ▼]      │
│             │                                             │
│             │  LEFT: ARB List (scrollable)                 │
│             │  ┌──────────────────┐  RIGHT: Profile View  │
│             │  │ Juan Dela Cruz   │  ┌──────────────────┐│
│             │  │ Maria Santos  ✓  │  │ 360° Profile     ││
│             │  │ Pedro Reyes      │  │                  ││
│             │  └──────────────────┘  │ [CLOA] [Loans]   ││
│             │                        │ [Grants] [Income] ││
│             │                        │ [Trainings]       ││
│             │                        │                   ││
│             │                        │ (tab content)     ││
│             │                        └──────────────────┘│
└───────────────────────────────────────────────────────────┘
```

On mobile: the list takes full width. Clicking an ARB pushes to the profile view (with a back button).

**Required functionality**:

1. **Firestore data**: Load ALL of these in parallel (use `onSnapshot`):
   - `/users` where role is `arb` or `arbo_head` — the ARB list
   - `/applications` — CLOA records
   - `/loans` — All loans
   - `/loanPayments` — All loan payments
   - `/grants` — All grants
   - `/grantReports` — All grant reports
   - `/loanIncomeExpenses` — All income/expense entries
   - `/trainings` — All trainings
   - `/trainingAcknowledgments` — Training responses

2. **Left panel: ARB List**
   - Searchable by name, barangay, municipality
   - Filter dropdown: All, With Active Loans, With Defaults, Profitable, Unprofitable
   - Each row shows: Name, Barangay, # active loans, quick profit/loss indicator
   - Click selects the ARB → right panel updates

3. **Right panel: ARB 360° Profile (tabs)**

   **Tab: CLOA Status**
   - Application status (under_review / forwarded / verified / awarded)
   - Land title details if awarded (title #, lot, area, municipality)
   - Timeline of status changes from audit logs

   **Tab: Loans**
   - All loans for this ARB (active, completed, defaulted)
   - Each loan: ID, amount, interest rate, balance, # defaults, status
   - Expand to see full payment schedule with receipt thumbnails
   - Summary: Total borrowed, total repaid, total outstanding

   **Tab: Grants**
   - All grants for this ARB (cash, materials, equipment, loan-type grants)
   - Type, amount, date provided, status
   - Grant reports submitted

   **Tab: Income & Expenses**
   - Full ledger for this ARB from `/loanIncomeExpenses`
   - Summary cards: Total Income, Total Expenses, Net Profit/Loss
   - Table of all entries
   - Trend: is this ARB profitable? Show green/red indicator

   **Tab: Trainings**
   - All trainings assigned to this ARB
   - Status: acknowledged / pending / declined
   - Completion rate

4. **Summary header on the right panel** (above tabs):
   - ARB name, contact, barangay, municipality
   - Quick stats: Active Loans, Total Outstanding, Net Profit, CLOA Status badge
   - Risk indicator: 🟢 Green (profitable + no defaults) / 🟡 Yellow (some issues) / 🔴 Red (defaulter + unprofitable)

**Layout pattern**: Follow the existing dual-pane pattern from `ReviewApps.tsx` — left list, right detail panel. On mobile, stack vertically with a back button.

**Export**: This component should be a named export: `export const BeneficiaryMonitor: React.FC = () => { ... }`

---

### TASK 3: Create Farm Monitoring Page
**File**: `src/pages/FarmMonitoring.tsx` (NEW)
**Status**: [ ]

A simpler page under Profitability Tracking. Shows all equipment and resources distributed through grants and loans.

**Purpose**: Track what government resources (equipment, fertilizer, seeds from grants; tractors/tools bought with loan money) were given to ARBs and their current status.

**Page structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ <Sidebar /> │  🚜 Farm Monitoring                           │
│             │                                               │
│             │  KPI Cards:                                   │
│             │  [Equipment Distributed] [Total Value]        │
│             │  [Active Loans for Equipment] [ARBs Covered]  │
│             │                                               │
│             │  [Equipment] [Materials] [All Resources] tabs  │
│             │                                               │
│             │  Table:                                        │
│             │  ARB Name | Resource | Type | Value | Status   │
│             │  Juan     | Tractor  | Loan | ₱50K | Active   │
│             │  Maria    | Fertilizer| Grant| ₱5K | Used     │
│             │  Pedro    | Seeds    | Grant| ₱2K | Planted   │
│             │                                               │
│             │  [Export CSV]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Data sources**:
- `/grants` where type is `equipment` or `raw_materials` → show as distributed resources
- `/loans` where purpose contains equipment-related keywords → show as loan-funded equipment
- `/grantReports` → show the latest status/report for each resource

**Tabs**:
- **Equipment**: Grants with type `equipment` + loans for equipment
- **Materials**: Grants with type `raw_materials` (fertilizer, seeds, etc.)
- **All Resources**: Combined view

**Per row**: ARB name, resource description, source (Grant/Loan), value, date, latest report status, link to grant report images

**Export**: CSV export using `exportToCSV()`.

**Named export**: `export const FarmMonitoring: React.FC = () => { ... }`

---

### TASK 4: Add Routes for New Pages
**File**: `src/App.tsx` (MODIFY)
**Status**: [ ]

**Step 4a**: Add imports at the top:
```typescript
import { BeneficiaryMonitor } from "./pages/BeneficiaryMonitor";
import { FarmMonitoring } from "./pages/FarmMonitoring";
```

**Step 4b**: Add routes before the wildcard fallback:
```tsx
<Route
  path="/beneficiary-monitor"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <BeneficiaryMonitor />
    </ProtectedRoute>
  }
/>

<Route
  path="/farm-monitoring"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <FarmMonitoring />
    </ProtectedRoute>
  }
/>
```

---

### TASK 5: Fix Mobile Layout Across All Pages
**File**: Multiple pages (MODIFY)
**Status**: [ ]

The mobile layout is broken because of two issues:

**Issue A**: The sidebar on mobile is a fixed overlay (`fixed inset-y-0 left-0 z-40`), but the mobile top header (`md:hidden`) pushes content down. When the sidebar is closed, pages use `flex h-screen` which doesn't account for the mobile header height.

**Fix**: In the Sidebar component, add `top-0` and ensure the mobile header height is accounted for. The sidebar already handles this with `md:relative md:translate-x-0` — the issue is in the **page layouts**.

**Issue B**: Some pages use `h-screen` without `overflow-hidden`, causing double scroll bars. Others have hardcoded pixel values or missing responsive breakpoints.

**Fix for EVERY page that has a `flex h-screen` wrapper**: Ensure the pattern is consistent:

```tsx
// CORRECT pattern for ALL pages:
<div className="flex h-screen bg-slate-50 overflow-hidden">
  <Sidebar />
  <main className="flex-1 overflow-y-auto">
    {/* Page content with responsive padding */}
    <div className="p-4 md:p-6 lg:p-8">
      {/* Content here */}
    </div>
  </main>
</div>
```

**Pages to check and fix** (every page that renders `<Sidebar />`):

| Page | Fix Needed |
|------|-----------|
| `LoanApplication.tsx` | Add `overflow-hidden` to outer div |
| `LoanManagement.tsx` | Add `overflow-hidden` to outer div |
| `Dashboard.tsx` | Has 4 different return blocks — normalize all of them |
| `GrantManagement.tsx` | Already correct — use as reference |
| All other pages | Verify consistent pattern |

**Issue C**: Tables and cards overflow on small screens. Key fixes:
- Wrap all `<table>` elements in `<div className="overflow-x-auto">` (many already do this)
- Ensure grid layouts use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (responsive breakpoints)
- Check that modal widths use `max-w-lg` or similar (not fixed widths)

**Issue D**: The mobile sidebar top header shows the hamburger menu. When opened, the sidebar should overlay correctly. Verify that the `z-40` on the sidebar and `z-30` on the backdrop are correct and that no page content has a higher z-index.

---

### TASK 6: Update Documentation
**File**: `PROJECT_TASKS.md`, `ERD.md`, `SESSION_HANDOVER.md` (MODIFY)
**Status**: [ ]

**PROJECT_TASKS.md** — Add Phase 16:

```markdown
## Phase 16: Sidebar Reorganization, Monitoring & Mobile Fix (2026-09-29)

### Sidebar Reorganization
- [ ] 16.1 Rewrite Sidebar.tsx — collapsible groups for admin, staff, encoder
- [ ] 16.2 Keep ARB and ARBO Head sidebar flat (no change)

### New Pages
- [ ] 16.3 Create BeneficiaryMonitor.tsx — 360° ARB profile view
- [ ] 16.4 Create FarmMonitoring.tsx — equipment and resource tracking
- [ ] 16.5 Add routes in App.tsx for new pages

### Mobile Fix
- [ ] 16.6 Fix mobile layout pattern across all pages (overflow-hidden, responsive padding)
- [ ] 16.7 Verify mobile sidebar overlay works correctly
- [ ] 16.8 Verify tables scroll horizontally on mobile

### Verification
- [ ] 16.9 `npm run build` passes with 0 TypeScript errors
- [ ] 16.10 Manual test: Admin sidebar shows grouped navigation
- [ ] 16.11 Manual test: Beneficiary Monitor shows ARB 360° view
- [ ] 16.12 Manual test: Mobile view works on all pages
```

**SESSION_HANDOVER.md** — Add to "What Has Been Built":
```
- ✅ **Sidebar Reorganization**: Admin sidebar grouped into 5 collapsible sections (Land Title, Microfinance, Profitability, System). ARB/ARBO Head sidebar stays flat.
- ✅ **Beneficiary Monitor**: Admin 360° view of any ARB — CLOA, loans, payments, grants, income/expenses, trainings on one page
- ✅ **Farm Monitoring**: Track equipment and resources distributed through grants/loans
- ✅ **Mobile Layout Fix**: Consistent responsive layout across all pages
```

---

## VERIFICATION CHECKLIST

- [ ] `npm run build` passes with **0 TypeScript errors**
- [ ] Admin sidebar shows 5 groups: Land Title Verification, Microfinance, Profitability Tracking, System + standalone Overview
- [ ] Groups collapse/expand when clicking header
- [ ] Active child highlights both the child item AND the group header
- [ ] Staff sidebar shows 2 groups: Land Title Verification, System
- [ ] Encoder sidebar shows 2 groups: Land Title Verification, System  
- [ ] ARB sidebar is unchanged (flat, 5 items)
- [ ] ARBO Head sidebar is unchanged (flat, 6 items)
- [ ] `/beneficiary-monitor` loads, shows ARB list on left, profile on right
- [ ] Clicking an ARB shows their CLOA, Loans, Grants, Income, Trainings tabs
- [ ] `/farm-monitoring` loads, shows equipment/materials distributed
- [ ] Mobile: hamburger menu opens sidebar as overlay
- [ ] Mobile: pages scroll correctly without double scroll bars
- [ ] Mobile: tables scroll horizontally

---

## IMPORTANT REMINDERS FOR WORKER

1. **Do NOT change ARB or ARBO Head sidebar** — they stay flat, only 5-6 items
2. **All groups default open** — user can collapse them, but initial state is all open
3. **`overflow-hidden`** on the outer `flex h-screen` div is critical — without it, mobile gets double scrollbars
4. **Tailwind v4** — use native classes, not arbitrary values
5. **Follow existing patterns** — study `GrantManagement.tsx` for page layout, `ReviewApps.tsx` for dual-pane layout
6. **Named exports** — `export const BeneficiaryMonitor` not `export default`
7. **Run `npm run build` after every task** — don't wait until the end
8. **Icons** — Check if `Tractor`, `UserSearch`, `Cog`, `Shield` exist in lucide-react. If any don't exist, substitute with the closest alternative (e.g., `Wrench` for Tractor, `Users` for UserSearch, `Settings2` for Cog, `ShieldCheck` for Shield). Check at https://lucide.dev/icons/

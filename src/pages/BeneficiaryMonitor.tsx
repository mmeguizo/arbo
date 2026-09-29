import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { formatDate } from "../utils/formatters";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

type ProfileTab = "cloa" | "loans" | "grants" | "ledger" | "trainings";

interface ARBUser {
  uid: string;
  name: string;
  email?: string;
  contact?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  arboId?: string;
}

interface ApplicationRecord {
  id: string;
  applicationId?: string;
  userId: string;
  userName?: string;
  status: string;
  submittedAt?: string;
}

interface LandTitle {
  id: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  titleNumber?: string;
  lotNumber?: string;
  areaHectares?: number;
  municipality?: string;
  status?: string;
}

interface LoanRecord {
  id: string;
  applicantId: string;
  applicantName?: string;
  principalAmount: number;
  interestRate?: number;
  remainingBalance?: number;
  totalPaid?: number;
  defaultedPayments?: number;
  status: string;
}

interface PaymentRecord {
  id: string;
  loanId: string;
  amountPaid?: number;
  amountDue?: number;
  status: string;
  dueDate?: string;
  receiptImage?: string;
}

interface GrantRecord {
  id: string;
  beneficiaryId?: string;
  beneficiaryName?: string;
  type?: string;
  description?: string;
  amount?: number;
  dateProvided?: string;
  status?: string;
}

interface GrantReport {
  id: string;
  grantId: string;
  beneficiaryId?: string;
  reportDate?: string;
  status?: string;
  notes?: string;
}

interface LedgerEntry {
  id: string;
  userId?: string;
  type: "income" | "expense";
  category?: string;
  description?: string;
  amount?: number;
  date?: string;
}

interface TrainingRecord {
  id: string;
  name?: string;
  date?: string;
  status?: string;
  assignedUserIds?: string[];
}

interface TrainingAck {
  id: string;
  trainingId: string;
  userId: string;
  status?: string;
}

interface AuditRecord {
  id: string;
  applicationId?: string | null;
  entityId?: string | null;
  actor?: string;
  action?: string;
  timestamp?: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  notes?: string;
}

const money = (value = 0) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const riskClasses = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
};

export const BeneficiaryMonitor: React.FC = () => {
  const [users, setUsers] = useState<ARBUser[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [landTitles, setLandTitles] = useState<LandTitle[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [grantReports, setGrantReports] = useState<GrantReport[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [trainings, setTrainings] = useState<TrainingRecord[]>([]);
  const [acks, setAcks] = useState<TrainingAck[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<ProfileTab>("cloa");
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [mobileProfile, setMobileProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(
        query(collection(db, "users"), where("role", "in", ["arb", "arbo_head"])),
        (snap) => {
          const list = snap.docs.map(
            (item) => ({ uid: item.id, ...item.data() }) as ARBUser,
          );
          setUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
          setSelectedUid((current) => current || list[0]?.uid || null);
          setLoading(false);
        },
      ),
      onSnapshot(collection(db, "applications"), (snap) =>
        setApplications(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ApplicationRecord),
        ),
      ),
      onSnapshot(collection(db, "landTitles"), (snap) =>
        setLandTitles(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as LandTitle),
        ),
      ),
      onSnapshot(collection(db, "loans"), (snap) =>
        setLoans(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as LoanRecord),
        ),
      ),
      onSnapshot(collection(db, "loanPayments"), (snap) =>
        setPayments(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as PaymentRecord),
        ),
      ),
      onSnapshot(collection(db, "grants"), (snap) =>
        setGrants(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as GrantRecord),
        ),
      ),
      onSnapshot(collection(db, "grantReports"), (snap) =>
        setGrantReports(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as GrantReport),
        ),
      ),
      onSnapshot(collection(db, "loanIncomeExpenses"), (snap) =>
        setLedger(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as LedgerEntry),
        ),
      ),
      onSnapshot(collection(db, "trainings"), (snap) =>
        setTrainings(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as TrainingRecord),
        ),
      ),
      onSnapshot(collection(db, "trainingAcknowledgments"), (snap) =>
        setAcks(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as TrainingAck),
        ),
      ),
      onSnapshot(collection(db, "auditLogs"), (snap) =>
        setAuditLogs(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditRecord),
        ),
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const metrics = useMemo(() => {
    const map = new Map<
      string,
      { active: number; defaults: boolean; profit: number; outstanding: number }
    >();
    users.forEach((user) => {
      const userLoans = loans.filter((loan) => loan.applicantId === user.uid);
      const userLedger = ledger.filter((entry) => entry.userId === user.uid);
      map.set(user.uid, {
        active: userLoans.filter((loan) => loan.status === "active").length,
        defaults:
          userLoans.some(
            (loan) =>
              loan.status === "defaulted" || (loan.defaultedPayments || 0) > 0,
          ) ||
          payments.some(
            (payment) =>
              userLoans.some((loan) => loan.id === payment.loanId) &&
              payment.status === "overdue",
          ),
        profit: userLedger.reduce(
          (total, entry) =>
            total + (entry.type === "income" ? entry.amount || 0 : -(entry.amount || 0)),
          0,
        ),
        outstanding: userLoans.reduce(
          (total, loan) => total + (loan.remainingBalance || 0),
          0,
        ),
      });
    });
    return map;
  }, [ledger, loans, payments, users]);

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return users.filter((user) => {
      const userMetrics = metrics.get(user.uid);
      const matchesSearch =
        !normalized ||
        [user.name, user.barangay, user.municipality]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && Boolean(userMetrics?.active)) ||
        (filter === "defaults" && userMetrics?.defaults) ||
        (filter === "profitable" && (userMetrics?.profit || 0) >= 0) ||
        (filter === "unprofitable" && (userMetrics?.profit || 0) < 0);
      return matchesSearch && matchesFilter;
    });
  }, [filter, metrics, search, users]);

  const selected = users.find((user) => user.uid === selectedUid) || null;
  const selectedLoans = selected
    ? loans.filter((loan) => loan.applicantId === selected.uid)
    : [];
  const selectedPayments = selected
    ? payments.filter((payment) =>
        selectedLoans.some((loan) => loan.id === payment.loanId),
      )
    : [];
  const selectedGrants = selected
    ? grants.filter((grant) => grant.beneficiaryId === selected.uid)
    : [];
  const selectedLedger = selected
    ? ledger.filter((entry) => entry.userId === selected.uid)
    : [];
  const selectedTrainings = selected
    ? trainings.filter((training) =>
        training.assignedUserIds?.includes(selected.uid),
      )
    : [];
  const selectedApplication = selected
    ? applications
        .filter((application) => application.userId === selected.uid)
        .sort((a, b) =>
          String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")),
        )[0]
    : undefined;
  const selectedTitles = selected
    ? landTitles.filter((title) => title.beneficiaryId === selected.uid)
    : [];
  const selectedAudit = selectedApplication
    ? auditLogs
        .filter(
          (log) =>
            log.applicationId === selectedApplication.id ||
            log.entityId === selectedApplication.applicationId,
        )
        .sort((a, b) =>
          String(b.timestamp || "").localeCompare(String(a.timestamp || "")),
        )
    : [];
  const selectedMetrics = selected ? metrics.get(selected.uid) : undefined;
  const totalIncome = selectedLedger
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + (entry.amount || 0), 0);
  const totalExpenses = selectedLedger
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + (entry.amount || 0), 0);
  const risk = selectedMetrics?.defaults
    ? "red"
    : (selectedMetrics?.profit || 0) < 0
      ? "yellow"
      : "green";

  const selectUser = (uid: string) => {
    setSelectedUid(uid);
    setTab("cloa");
    setMobileProfile(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-14 md:p-6 md:pt-0 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <header>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
              Profitability Tracking
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Beneficiary Monitor
            </h1>
            <p className="text-sm text-slate-500">
              Review each ARB&apos;s CLOA, finance, grant, training, and risk
              profile in one place.
            </p>
          </header>
          <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
            <section className={`${mobileProfile ? "hidden lg:block" : ""} rounded-xl border border-slate-200 bg-white p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <Search size={15} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or location"
                  className="w-full text-sm outline-none"
                />
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="all">All beneficiaries</option>
                <option value="active">With active loans</option>
                <option value="defaults">With defaults</option>
                <option value="profitable">Profitable</option>
                <option value="unprofitable">Unprofitable</option>
              </select>
              <div className="max-h-[calc(100vh-250px)] space-y-1 overflow-y-auto">
                {visibleUsers.map((user) => {
                  const userMetrics = metrics.get(user.uid);
                  return (
                    <button
                      key={user.uid}
                      onClick={() => selectUser(user.uid)}
                      className={`w-full rounded-lg p-3 text-left transition ${
                        selectedUid === user.uid
                          ? "bg-emerald-50 ring-1 ring-emerald-300"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-800">
                          {user.name}
                        </span>
                        {userMetrics?.profit !== undefined &&
                          (userMetrics.profit >= 0 ? (
                            <TrendingUp size={14} className="text-emerald-600" />
                          ) : (
                            <TrendingDown size={14} className="text-red-600" />
                          ))}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {user.barangay || "—"}, {user.municipality || "—"} ·{" "}
                        {userMetrics?.active || 0} active loan(s)
                      </p>
                    </button>
                  );
                })}
                {visibleUsers.length === 0 && (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No beneficiaries match the current filter.
                  </p>
                )}
              </div>
            </section>

            <section className={`${!mobileProfile ? "hidden lg:block" : ""} min-w-0`}>
              {!selected ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-400">
                  {loading ? "Loading beneficiaries..." : "Select an ARB to view the profile."}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setMobileProfile(false)}
                    className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 lg:hidden"
                  >
                    <ArrowLeft size={14} /> Back to beneficiaries
                  </button>
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                          360° Beneficiary Profile
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                          {selected.name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {selected.contact || selected.email || "No contact"} ·{" "}
                          {selected.barangay || "—"}, {selected.municipality || "—"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskClasses[risk]}`}>
                        {risk === "green" ? "Low risk" : risk === "yellow" ? "Watch" : "High risk"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Stat label="Active loans" value={String(selectedMetrics?.active || 0)} />
                      <Stat label="Outstanding" value={money(selectedMetrics?.outstanding)} />
                      <Stat label="Net profit" value={money(selectedMetrics?.profit)} />
                      <Stat label="CLOA status" value={selectedApplication?.status || "—"} />
                    </div>
                  </div>
                  <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
                    {([
                      ["cloa", "CLOA Status"],
                      ["loans", "Loans"],
                      ["grants", "Grants"],
                      ["ledger", "Income & Expenses"],
                      ["trainings", "Trainings"],
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${
                          tab === id
                            ? "bg-emerald-700 text-white"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <ProfileContent
                    tab={tab}
                    application={selectedApplication}
                    titles={selectedTitles}
                    audit={selectedAudit}
                    loans={selectedLoans}
                    payments={selectedPayments}
                    grants={selectedGrants}
                    grantReports={grantReports}
                    ledger={selectedLedger}
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    trainings={selectedTrainings}
                    acks={acks}
                    selectedUid={selected.uid}
                    expandedLoan={expandedLoan}
                    setExpandedLoan={setExpandedLoan}
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
    <p className="mt-1 truncate text-sm font-bold text-slate-800">{value}</p>
  </div>
);

const ProfileContent: React.FC<{
  tab: ProfileTab;
  application?: ApplicationRecord;
  titles: LandTitle[];
  audit: AuditRecord[];
  loans: LoanRecord[];
  payments: PaymentRecord[];
  grants: GrantRecord[];
  grantReports: GrantReport[];
  ledger: LedgerEntry[];
  totalIncome: number;
  totalExpenses: number;
  trainings: TrainingRecord[];
  acks: TrainingAck[];
  selectedUid: string;
  expandedLoan: string | null;
  setExpandedLoan: (id: string | null) => void;
}> = ({
  tab,
  application,
  titles,
  audit,
  loans,
  payments,
  grants,
  grantReports,
  ledger,
  totalIncome,
  totalExpenses,
  trainings,
  acks,
  selectedUid,
  expandedLoan,
  setExpandedLoan,
}) => {
  if (tab === "cloa") {
    return (
      <Panel title="CLOA Status" icon={<ShieldCheck size={16} />}>
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Application status</p>
          <p className="mt-1 font-bold text-slate-800">{application?.status || "No application found"}</p>
        </div>
        {titles.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {titles.map((title) => (
              <div key={title.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-bold text-slate-800">{title.titleNumber || "Untitled record"}</p>
                <p className="mt-1 text-slate-500">
                  Lot {title.lotNumber || "—"} · {title.areaHectares || 0} ha ·{" "}
                  {title.municipality || "—"}
                </p>
                <p className="mt-1 text-emerald-700">{title.status || "—"}</p>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {audit.map((log) => (
            <div key={log.id} className="border-l-2 border-emerald-200 pl-3 text-xs">
              <p className="font-bold text-slate-700">{log.action || "Activity"}</p>
              <p className="text-slate-500">
                {log.oldStatus || "—"} → {log.newStatus || "recorded"} ·{" "}
                {log.timestamp ? formatDate(log.timestamp) : "—"}
              </p>
              {log.notes && <p className="mt-1 text-slate-500">{log.notes}</p>}
            </div>
          ))}
          {audit.length === 0 && <p className="text-xs text-slate-400">No recorded status timeline.</p>}
        </div>
      </Panel>
    );
  }

  if (tab === "loans") {
    return (
      <Panel title="Loans" icon={<Landmark size={16} />}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Borrowed" value={money(loans.reduce((sum, loan) => sum + loan.principalAmount, 0))} />
          <Stat label="Repaid" value={money(loans.reduce((sum, loan) => sum + (loan.totalPaid || 0), 0))} />
          <Stat label="Outstanding" value={money(loans.reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0))} />
        </div>
        <div className="space-y-2">
          {loans.map((loan) => {
            const loanPayments = payments.filter((payment) => payment.loanId === loan.id);
            const open = expandedLoan === loan.id;
            return (
              <div key={loan.id} className="rounded-lg border border-slate-200">
                <button onClick={() => setExpandedLoan(open ? null : loan.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                  <span>
                    <b className="text-emerald-700">{loan.id}</b>
                    <span className="ml-2 text-xs text-slate-500">{money(loan.principalAmount)} · {loan.status}</span>
                  </span>
                  {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-slate-100 p-3">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-slate-400"><tr><th className="p-2">#</th><th className="p-2">Due</th><th className="p-2">Paid</th><th className="p-2">Status</th><th className="p-2">Receipt</th></tr></thead>
                      <tbody>{loanPayments.map((payment, index) => <tr key={payment.id} className="border-t border-slate-100"><td className="p-2">{index + 1}</td><td className="p-2">{payment.dueDate ? formatDate(payment.dueDate) : "—"}</td><td className="p-2">{money(payment.amountPaid)}</td><td className="p-2">{payment.status}</td><td className="p-2">{payment.receiptImage ? <a className="text-emerald-700 underline" href={payment.receiptImage} target="_blank" rel="noreferrer">View</a> : "—"}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {loans.length === 0 && <p className="text-xs text-slate-400">No loans found.</p>}
        </div>
      </Panel>
    );
  }

  if (tab === "grants") {
    return (
      <Panel title="Grants" icon={<FileText size={16} />}>
        <div className="space-y-2">
          {grants.map((grant) => {
            const reports = grantReports.filter((report) => report.grantId === grant.id);
            return <div key={grant.id} className="rounded-lg border border-slate-200 p-3 text-xs"><div className="flex justify-between gap-3"><b>{grant.description || grant.type || "Grant"}</b><span>{money(grant.amount)}</span></div><p className="mt-1 text-slate-500">{grant.type} · {grant.dateProvided ? formatDate(grant.dateProvided) : "—"} · {grant.status || "—"}</p><p className="mt-1 text-emerald-700">{reports.length} report(s) submitted</p></div>;
          })}
          {grants.length === 0 && <p className="text-xs text-slate-400">No grants found.</p>}
        </div>
      </Panel>
    );
  }

  if (tab === "ledger") {
    return (
      <Panel title="Income & Expenses" icon={<BarChart3 size={16} />}>
        <div className="grid grid-cols-3 gap-3"><Stat label="Income" value={money(totalIncome)} /><Stat label="Expenses" value={money(totalExpenses)} /><Stat label="Net" value={money(totalIncome - totalExpenses)} /></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[10px] uppercase text-slate-400"><tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Amount</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="p-2">{entry.date ? formatDate(entry.date) : "—"}</td><td className={`p-2 font-bold ${entry.type === "income" ? "text-emerald-700" : "text-red-700"}`}>{entry.type}</td><td className="p-2">{entry.description || entry.category || "—"}</td><td className="p-2 font-bold">{money(entry.amount)}</td></tr>)}</tbody></table></div>
        {ledger.length === 0 && <p className="text-xs text-slate-400">No income or expense entries found.</p>}
      </Panel>
    );
  }

  return (
    <Panel title="Trainings" icon={<Users size={16} />}>
      <div className="space-y-2">
        {trainings.map((training) => {
          const ack = acks.find((item) => item.trainingId === training.id && item.userId === selectedUid);
          return <div key={training.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-xs"><span><b>{training.name || "Training"}</b><span className="ml-2 text-slate-500">{training.date ? formatDate(training.date) : "—"}</span></span><span className="font-bold text-emerald-700">{ack?.status || "pending"}</span></div>;
        })}
        {trainings.length === 0 && <p className="text-xs text-slate-400">No assigned trainings found.</p>}
      </div>
    </Panel>
  );
};

const Panel: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-800">
      <span className="text-emerald-700">{icon}</span>
      {title}
    </div>
    {children}
  </div>
);

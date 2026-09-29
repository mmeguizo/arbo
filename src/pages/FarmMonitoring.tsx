import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { exportToCSV, formatDate } from "../utils/formatters";
import {
  Download,
  Factory,
  Landmark,
  Package,
  Search,
  Users,
} from "lucide-react";

type ResourceTab = "equipment" | "materials" | "all";

interface GrantResource {
  id: string;
  beneficiaryName?: string;
  beneficiaryId?: string;
  type?: string;
  description?: string;
  amount?: number;
  dateProvided?: string;
  status?: string;
  equipmentItem?: string;
}

interface LoanResource {
  id: string;
  applicantName?: string;
  purpose?: string;
  principalAmount?: number;
  createdAt?: string;
  status?: string;
}

interface GrantReport {
  id: string;
  grantId: string;
  reportDate?: string;
  status?: string;
  notes?: string;
  images?: string[];
}

interface ResourceRow {
  id: string;
  beneficiary: string;
  resource: string;
  type: "Equipment" | "Materials";
  source: "Grant" | "Loan";
  value: number;
  date: string;
  status: string;
  report?: GrantReport;
}

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const FarmMonitoring: React.FC = () => {
  const [grants, setGrants] = useState<GrantResource[]>([]);
  const [loans, setLoans] = useState<LoanResource[]>([]);
  const [reports, setReports] = useState<GrantReport[]>([]);
  const [tab, setTab] = useState<ResourceTab>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubGrants = onSnapshot(collection(db, "grants"), (snap) => {
      setGrants(
        snap.docs
          .map((item) => ({ id: item.id, ...item.data() }) as GrantResource)
          .filter((grant) => ["equipment", "raw_materials"].includes(grant.type || "")),
      );
      setLoading(false);
    });
    const unsubLoans = onSnapshot(collection(db, "loans"), (snap) =>
      setLoans(
        snap.docs.map((item) => ({ id: item.id, ...item.data() }) as LoanResource),
      ),
    );
    const unsubReports = onSnapshot(collection(db, "grantReports"), (snap) =>
      setReports(
        snap.docs.map((item) => ({ id: item.id, ...item.data() }) as GrantReport),
      ),
    );
    return () => {
      unsubGrants();
      unsubLoans();
      unsubReports();
    };
  }, []);

  const rows = useMemo<ResourceRow[]>(() => {
    const grantRows: ResourceRow[] = grants.map((grant) => {
      const grantReports = reports
        .filter((report) => report.grantId === grant.id)
        .sort((a, b) =>
          String(b.reportDate || "").localeCompare(String(a.reportDate || "")),
        );
      return {
        id: `grant-${grant.id}`,
        beneficiary: grant.beneficiaryName || grant.beneficiaryId || "Unknown ARB",
        resource: grant.equipmentItem || grant.description || "Grant resource",
        type: grant.type === "equipment" ? "Equipment" : "Materials",
        source: "Grant",
        value: grant.amount || 0,
        date: grant.dateProvided || "",
        status: grantReports[0]?.status || grant.status || "active",
        report: grantReports[0],
      };
    });
    const loanRows: ResourceRow[] = loans
      .filter((loan) =>
        /equipment|tractor|tool|machin|fertilizer|seed|farm/i.test(
          loan.purpose || "",
        ),
      )
      .map((loan) => ({
        id: `loan-${loan.id}`,
        beneficiary: loan.applicantName || "Unknown ARB",
        resource: loan.purpose || "Equipment-related loan",
        type: /fertilizer|seed/i.test(loan.purpose || "")
          ? "Materials"
          : "Equipment",
        source: "Loan",
        value: loan.principalAmount || 0,
        date: loan.createdAt || "",
        status: loan.status || "active",
      }));
    return [...grantRows, ...loanRows].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [grants, loans, reports]);

  const visibleRows = rows.filter((row) => {
    const matchesTab = tab === "all" || row.type.toLowerCase() === tab;
    const normalized = search.trim().toLowerCase();
    const matchesSearch =
      !normalized ||
      `${row.beneficiary} ${row.resource} ${row.source} ${row.status}`
        .toLowerCase()
        .includes(normalized);
    return matchesTab && matchesSearch;
  });

  const equipmentCount = rows.filter((row) => row.type === "Equipment").length;
  const totalValue = rows.reduce((total, row) => total + row.value, 0);
  const activeEquipmentLoans = rows.filter(
    (row) => row.source === "Loan" && row.type === "Equipment" && row.status === "active",
  ).length;
  const arbCount = new Set(rows.map((row) => row.beneficiary)).size;

  const exportRows = () =>
    exportToCSV(
      "farm-monitoring-resources",
      ["beneficiary", "resource", "type", "source", "value", "date", "status"],
      visibleRows.map((row) => ({ ...row })),
      {
        beneficiary: "ARB",
        resource: "Resource",
        type: "Type",
        source: "Source",
        value: "Value",
        date: "Date",
        status: "Status",
      },
    );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-14 md:p-6 md:pt-0 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Profitability Tracking
              </p>
              <h1 className="text-2xl font-bold text-slate-900">Farm Monitoring</h1>
              <p className="text-sm text-slate-500">
                Track equipment and materials distributed through grants and loans.
              </p>
            </div>
            <button
              onClick={exportRows}
              disabled={visibleRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Download size={14} /> Export CSV
            </button>
          </header>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Equipment distributed" value={String(equipmentCount)} icon={<Factory size={17} />} />
            <Kpi label="Total value" value={money(totalValue)} icon={<Package size={17} />} />
            <Kpi label="Equipment loans" value={String(activeEquipmentLoans)} icon={<Landmark size={17} />} />
            <Kpi label="ARBs covered" value={String(arbCount)} icon={<Users size={17} />} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["all", "All Resources"],
              ["equipment", "Equipment"],
              ["materials", "Materials"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  tab === id ? "bg-emerald-700 text-white" : "bg-white text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="relative ml-auto min-w-60">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ARB or resource"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-emerald-600"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="p-3">ARB</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Latest status</th>
                  <th className="p-3">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 font-bold text-slate-800">{row.beneficiary}</td>
                    <td className="p-3">{row.resource}</td>
                    <td className="p-3">{row.type}</td>
                    <td className="p-3">{row.source}</td>
                    <td className="p-3 font-bold">{money(row.value)}</td>
                    <td className="p-3">{row.date ? formatDate(row.date) : "—"}</td>
                    <td className="p-3">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold">
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.report?.images?.[0] ? (
                        <a
                          href={row.report.images[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 underline"
                        >
                          View image
                        </a>
                      ) : row.report ? (
                        <span className="text-slate-500">{row.report.status || "Submitted"}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      No farm resources match the current view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

const Kpi: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-2 flex items-center gap-2 text-emerald-700">
      {icon}
      <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
    </div>
    <p className="text-lg font-extrabold text-slate-900">{value}</p>
  </div>
);

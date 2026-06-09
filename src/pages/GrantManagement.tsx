import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { formatDate } from "../utils/formatters";
import { exportToCSV } from "../utils/formatters";
import {
  DollarSign,
  Package,
  FileText,
  Plus,
  X,
  Search,
  Download,
  Users,
  BarChart3,
  PieChart,
  MapPin,
  Eye,
  AlertCircle,
  Building2,
} from "lucide-react";

interface Grant {
  id: string;
  beneficiaryId: string;
  beneficiaryName: string;
  type: "cash" | "raw_materials";
  description: string;
  amount: number;
  unit: string;
  dateProvided: string;
  reportCycle: "6_months" | "1_year";
  nextReportDue: string;
  status: "active" | "completed" | "overdue";
  createdAt: string;
  createdBy: string;
  isCoopGrant?: boolean;
  cooperativeId?: string;
  cooperativeName?: string;
}

interface GrantReport {
  id: string;
  grantId: string;
  beneficiaryId: string;
  reportDate: string;
  period: string;
  notes: string;
  images: string[];
  documents: string[];
  incomeGenerated: number;
  harvestYield: string;
  receiptAmount: number;
  status: "submitted" | "reviewed";
  createdAt: string;
}

interface ARBUser {
  uid: string;
  name: string;
  barangay: string;
  municipality: string;
}

export const GrantManagement: React.FC = () => {
  const { profile } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [reports, setReports] = useState<GrantReport[]>([]);
  const [arbUsers, setArbUsers] = useState<ARBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "cash" | "raw_materials"
  >("all");

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedARB, setSelectedARB] = useState<ARBUser | null>(null);
  const [detailARB, setDetailARB] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<"cash" | "raw_materials">("cash");
  const [formAmount, setFormAmount] = useState("");
  const [formUnit, setFormUnit] = useState("PHP");
  const [formDescription, setFormDescription] = useState("");
  const [formCycle, setFormCycle] = useState<"6_months" | "1_year">("1_year");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cooperative grant state
  const [grantTarget, setGrantTarget] = useState<"individual" | "cooperative">(
    "individual",
  );
  const [selectedCoopId, setSelectedCoopId] = useState<string | null>(null);
  const [cooperatives, setCooperatives] = useState<
    { id: string; name: string; municipality: string }[]
  >([]);
  const [allCoopMembers, setAllCoopMembers] = useState<
    { cooperativeId: string; userId: string; userName: string }[]
  >([]);

  // Load cooperatives and members for coop grant flow
  useEffect(() => {
    const unsubCoops = onSnapshot(collection(db, "cooperatives"), (snap) => {
      const list: { id: string; name: string; municipality: string }[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name,
          municipality: data.municipality,
        });
      });
      setCooperatives(list);
    });
    const unsubMembers = onSnapshot(
      collection(db, "cooperativeMembers"),
      (snap) => {
        const list: {
          cooperativeId: string;
          userId: string;
          userName: string;
        }[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            cooperativeId: data.cooperativeId,
            userId: data.userId,
            userName: data.userName,
          });
        });
        setAllCoopMembers(list);
      },
    );
    return () => {
      unsubCoops();
      unsubMembers();
    };
  }, []);

  useEffect(() => {
    setLoading(true);

    const unsubGrants = onSnapshot(
      query(collection(db, "grants"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: Grant[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            beneficiaryId: data.beneficiaryId,
            beneficiaryName: data.beneficiaryName,
            type: data.type,
            description: data.description,
            amount: data.amount,
            unit: data.unit,
            dateProvided: data.dateProvided,
            reportCycle: data.reportCycle,
            nextReportDue: data.nextReportDue,
            status: data.status,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            isCoopGrant: data.isCoopGrant || false,
            cooperativeId: data.cooperativeId || null,
            cooperativeName: data.cooperativeName || null,
          });
        });
        setGrants(list);
        setLoading(false);
      },
    );

    const unsubReports = onSnapshot(collection(db, "grantReports"), (snap) => {
      const list: GrantReport[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          grantId: data.grantId,
          beneficiaryId: data.beneficiaryId,
          reportDate: data.reportDate,
          period: data.period,
          notes: data.notes,
          images: data.images || [],
          documents: data.documents || [],
          incomeGenerated: data.incomeGenerated || 0,
          harvestYield: data.harvestYield || "",
          receiptAmount: data.receiptAmount || 0,
          status: data.status || "submitted",
          createdAt: data.createdAt,
        });
      });
      setReports(list);
    });

    const unsubARBs = onSnapshot(
      query(collection(db, "users"), where("role", "==", "arb")),
      (snap) => {
        const list: ARBUser[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            uid: d.id,
            name: data.name || "Unknown",
            barangay: data.barangay || "",
            municipality: data.municipality || "",
          });
        });
        setArbUsers(list);
      },
    );

    return () => {
      unsubGrants();
      unsubReports();
      unsubARBs();
    };
  }, []);

  const filteredGrants = useMemo(() => {
    let result = grants;
    if (typeFilter !== "all") {
      result = result.filter((g) => g.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.beneficiaryName.toLowerCase().includes(term) ||
          g.description.toLowerCase().includes(term),
      );
    }
    return result;
  }, [grants, typeFilter, searchQuery]);

  const totalCashDistributed = grants
    .filter((g) => g.type === "cash")
    .reduce((s, g) => s + g.amount, 0);
  const totalRawMaterials = grants.filter(
    (g) => g.type === "raw_materials",
  ).length;
  const totalARBsWithGrants = new Set(grants.map((g) => g.beneficiaryId)).size;
  const overdueCount = grants.filter((g) => g.status === "overdue").length;
  const totalReports = reports.length;

  const currentYear = new Date().getFullYear();
  const monthlyGrantData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const count = grants.filter((g) => {
        const d = new Date(g.dateProvided);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      }).length;
      const name = new Date(currentYear, i).toLocaleDateString("en-US", {
        month: "short",
      });
      return { name, count, month: i };
    });
    return months;
  }, [grants, currentYear]);
  const maxMonthly = Math.max(...monthlyGrantData.map((m) => m.count), 1);

  const cashCount = grants.filter((g) => g.type === "cash").length;
  const rawCount = grants.filter((g) => g.type === "raw_materials").length;
  const totalGrants = grants.length;
  const donutStyle = useMemo(() => {
    if (totalGrants === 0) return {};
    const cashPct = totalGrants > 0 ? (cashCount / totalGrants) * 100 : 0;
    const rawPct = totalGrants > 0 ? (rawCount / totalGrants) * 100 : 0;
    return {
      background: `conic-gradient(#10b981 0% ${cashPct}%, #f59e0b ${cashPct}% ${cashPct + rawPct}%)`,
    };
  }, [totalGrants, cashCount, rawCount]);

  const topARBs = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; totalIncome: number }
    >();
    grants.forEach((g) => {
      const existing = map.get(g.beneficiaryId) || {
        name: g.beneficiaryName,
        count: 0,
        totalIncome: 0,
      };
      existing.count++;
      map.set(g.beneficiaryId, existing);
    });
    reports.forEach((r) => {
      const existing = map.get(r.beneficiaryId);
      if (existing) {
        existing.totalIncome += r.incomeGenerated || 0;
        map.set(r.beneficiaryId, existing);
      }
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [grants, reports]);
  const maxARBCount = Math.max(...topARBs.map((a) => a.count), 1);

  const getSelectedCoopMembers = () => {
    if (!selectedCoopId) return [];
    return allCoopMembers.filter((m) => m.cooperativeId === selectedCoopId);
  };

  const addGrant = async () => {
    setFormError(null);

    if (grantTarget === "individual") {
      if (!selectedARB) {
        setFormError("Please select a beneficiary.");
        return;
      }
    } else {
      if (!selectedCoopId) {
        setFormError("Please select a cooperative.");
        return;
      }
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      setFormError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);

    try {
      const dateProvided = new Date().toISOString();
      const monthsToAdd = formCycle === "6_months" ? 6 : 12;
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + monthsToAdd);

      if (grantTarget === "individual") {
        await addDoc(collection(db, "grants"), {
          beneficiaryId: selectedARB!.uid,
          beneficiaryName: selectedARB!.name,
          type: formType,
          description: formDescription.trim(),
          amount: parseFloat(formAmount),
          unit: formUnit,
          dateProvided,
          reportCycle: formCycle,
          nextReportDue: nextDue.toISOString(),
          status: "active",
          createdAt: dateProvided,
          createdBy: profile?.name || "Admin",
          isCoopGrant: false,
          cooperativeId: null,
          cooperativeName: null,
        });
      } else {
        const coopMembers = getSelectedCoopMembers();
        const selectedCoop = cooperatives.find((c) => c.id === selectedCoopId);

        if (formType === "cash") {
          const totalAmount = parseFloat(formAmount);
          const perMember = Math.floor(totalAmount / coopMembers.length);
          const remainder = totalAmount - perMember * coopMembers.length;

          for (let i = 0; i < coopMembers.length; i++) {
            const member = coopMembers[i];
            await addDoc(collection(db, "grants"), {
              beneficiaryId: member.userId,
              beneficiaryName: member.userName,
              type: formType,
              description: formDescription.trim(),
              amount: perMember + (i === 0 ? remainder : 0),
              unit: formUnit,
              dateProvided,
              reportCycle: formCycle,
              nextReportDue: nextDue.toISOString(),
              status: "active",
              createdAt: dateProvided,
              createdBy: profile?.name || "Admin",
              isCoopGrant: true,
              cooperativeId: selectedCoopId,
              cooperativeName: selectedCoop?.name || "",
            });
          }
        } else {
          const totalQty = parseInt(formAmount) || 0;
          const perMember = Math.floor(totalQty / coopMembers.length);
          const remainder = totalQty - perMember * coopMembers.length;

          for (let i = 0; i < coopMembers.length; i++) {
            const member = coopMembers[i];
            await addDoc(collection(db, "grants"), {
              beneficiaryId: member.userId,
              beneficiaryName: member.userName,
              type: formType,
              description: formDescription.trim(),
              amount: perMember + (i === 0 ? remainder : 0),
              unit: formUnit,
              dateProvided,
              reportCycle: formCycle,
              nextReportDue: nextDue.toISOString(),
              status: "active",
              createdAt: dateProvided,
              createdBy: profile?.name || "Admin",
              isCoopGrant: true,
              cooperativeId: selectedCoopId,
              cooperativeName: selectedCoop?.name || "",
            });
          }
        }
      }

      setShowAddModal(false);
      setSelectedARB(null);
      setSelectedCoopId(null);
      setGrantTarget("individual");
      setFormType("cash");
      setFormAmount("");
      setFormUnit("PHP");
      setFormDescription("");
      setFormCycle("1_year");
    } catch (err) {
      console.error(err);
      setFormError("Failed to create grant.");
    } finally {
      setSubmitting(false);
    }
  };

  const exportGrantsCSV = () => {
    if (grants.length === 0) return;
    exportToCSV(
      `Grants_Data_${new Date().toISOString().split("T")[0]}`,
      [
        "beneficiaryName",
        "type",
        "amount",
        "unit",
        "description",
        "dateProvided",
        "reportCycle",
        "nextReportDue",
        "status",
      ],
      grants as unknown as Record<string, unknown>[],
      {
        beneficiaryName: "ARB Name",
        type: "Grant Type",
        amount: "Amount",
        unit: "Unit",
        description: "Description",
        dateProvided: "Date Provided",
        reportCycle: "Report Cycle",
        nextReportDue: "Next Report Due",
        status: "Status",
      },
    );
  };

  const getARBGrants = (arbId: string) =>
    grants.filter((g) => g.beneficiaryId === arbId);
  const getGrantReports = (grantId: string) =>
    reports.filter((r) => r.grantId === grantId);

  const selectedARBData = detailARB
    ? arbUsers.find((a) => a.uid === detailARB)
    : null;
  const selectedCoopMembers = getSelectedCoopMembers();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Grant Administration
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Profitability & Grant Management
            </h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={14} /> New Grant
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500">
                Loading grant data...
              </p>
            </div>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-7xl">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign size={14} className="text-emerald-600" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Cash Distributed
                  </span>
                </div>
                <p className="text-xl font-extrabold text-emerald-900">
                  ₱{totalCashDistributed.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <Package size={14} className="text-amber-600" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Material Grants
                  </span>
                </div>
                <p className="text-xl font-extrabold text-amber-900">
                  {totalRawMaterials}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={14} className="text-indigo-600" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    ARBs w/ Grants
                  </span>
                </div>
                <p className="text-xl font-extrabold text-indigo-900">
                  {totalARBsWithGrants}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle size={14} className="text-red-500" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Overdue
                  </span>
                </div>
                <p className="text-xl font-extrabold text-red-700">
                  {overdueCount}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={14} className="text-blue-600" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                    Reports
                  </span>
                </div>
                <p className="text-xl font-extrabold text-blue-900">
                  {totalReports}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <BarChart3 size={16} className="text-emerald-700" />
                      Grants Distributed ({currentYear})
                    </h3>
                  </div>
                  <button
                    onClick={exportGrantsCSV}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>
                <div className="flex items-end gap-1 h-32">
                  {monthlyGrantData.map((m) => {
                    const height = (m.count / maxMonthly) * 100;
                    return (
                      <div
                        key={m.month}
                        className="flex-1 flex flex-col items-center gap-1 group"
                      >
                        <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100">
                          {m.count}
                        </span>
                        <div
                          className="w-full rounded-t-md bg-emerald-600 hover:bg-emerald-700 transition-colors"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        ></div>
                        <span className="text-[8px] text-slate-400">
                          {m.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <PieChart size={16} className="text-emerald-700" />
                      Grant Type Distribution
                    </h3>
                  </div>
                </div>
                {totalGrants > 0 ? (
                  <div className="flex items-center gap-6">
                    <div
                      className="h-28 w-28 rounded-full shrink-0 border-4 border-white shadow-md"
                      style={donutStyle}
                    ></div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500"></div>
                        <span className="text-slate-600">Cash</span>
                        <span className="font-bold text-slate-800">
                          {cashCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500"></div>
                        <span className="text-slate-600">Raw Materials</span>
                        <span className="font-bold text-slate-800">
                          {rawCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No grants yet</p>
                )}
              </div>
            </div>

            {topARBs.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-5">
                  <Users size={16} className="text-emerald-700" />
                  Top ARBs by Grants Received
                </h3>
                <div className="space-y-3">
                  {topARBs.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <button
                        onClick={() => setDetailARB(a.id)}
                        className="text-xs font-bold text-slate-700 w-36 truncate shrink-0 text-left hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        {a.name}
                      </button>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${(a.count / maxARBCount) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-8 text-right shrink-0">
                        {a.count}
                      </span>
                      {a.totalIncome > 0 && (
                        <span className="text-[10px] text-emerald-700 w-24 text-right shrink-0">
                          ₱{a.totalIncome.toLocaleString()} income
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search ARB or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2">
                  {(
                    [
                      { v: "all", label: "All" },
                      { v: "cash", label: "Cash" },
                      { v: "raw_materials", label: "Materials" },
                    ] as const
                  ).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => setTypeFilter(v)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${typeFilter === v ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">ARB</th>
                      <th className="px-6 py-4 text-left">Type</th>
                      <th className="px-6 py-4 text-left">Amount</th>
                      <th className="px-6 py-4 text-left">Description</th>
                      <th className="px-6 py-4 text-left">Provided</th>
                      <th className="px-6 py-4 text-left">Next Report</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-center">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredGrants.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-12 text-center text-slate-400 italic text-xs"
                        >
                          No grants found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredGrants.map((g) => {
                        const grantReports = getGrantReports(g.id);
                        const statusColor =
                          g.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : g.status === "overdue"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700";
                        return (
                          <tr
                            key={g.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-bold text-slate-700">
                              <button
                                onClick={() => setDetailARB(g.beneficiaryId)}
                                className="hover:text-emerald-700 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                {g.beneficiaryName}
                                {(g as any).isCoopGrant &&
                                  (g as any).cooperativeName && (
                                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                                      <Building2
                                        size={9}
                                        className="inline mr-0.5"
                                      />
                                      {(g as any).cooperativeName}
                                    </span>
                                  )}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.type === "cash" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                {g.type === "cash" ? "Cash" : "Materials"}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">
                              {g.type === "cash"
                                ? `₱${g.amount.toLocaleString()}`
                                : `${g.amount} ${g.unit}`}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                              {g.description || "—"}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                              {formatDate(g.dateProvided)}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500">
                              {formatDate(g.nextReportDue)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}
                              >
                                {g.status.charAt(0).toUpperCase() +
                                  g.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => setDetailARB(g.beneficiaryId)}
                                className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                              >
                                <Eye size={12} />
                                {grantReports.length}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Add Grant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 my-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-sm text-slate-900">
                Issue New Grant
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:bg-slate-200 p-2 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Grant Target Toggle */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Grant Target
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setGrantTarget("individual");
                      setSelectedCoopId(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${grantTarget === "individual" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Individual ARB
                  </button>
                  <button
                    onClick={() => {
                      setGrantTarget("cooperative");
                      setSelectedARB(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${grantTarget === "cooperative" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Cooperative
                  </button>
                </div>
              </div>

              {/* Individual ARB */}
              {grantTarget === "individual" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Beneficiary (ARB)
                  </label>
                  <select
                    value={selectedARB?.uid || ""}
                    onChange={(e) => {
                      const found = arbUsers.find(
                        (a) => a.uid === e.target.value,
                      );
                      setSelectedARB(found || null);
                    }}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select an ARB...</option>
                    {arbUsers.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.name} ({a.municipality})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cooperative */}
              {grantTarget === "cooperative" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Cooperative
                  </label>
                  <select
                    value={selectedCoopId || ""}
                    onChange={(e) => setSelectedCoopId(e.target.value || null)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select a cooperative...</option>
                    {cooperatives.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.municipality}) —{" "}
                        {
                          allCoopMembers.filter((m) => m.cooperativeId === c.id)
                            .length
                        }{" "}
                        members
                      </option>
                    ))}
                  </select>
                  {selectedCoopId && selectedCoopMembers.length > 0 && (
                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <p className="text-[10px] font-bold text-indigo-700 mb-1.5">
                        Split Preview ({selectedCoopMembers.length} members):
                      </p>
                      <div className="space-y-1">
                        {selectedCoopMembers.map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between text-xs text-slate-600"
                          >
                            <span>{m.userName}</span>
                            {formAmount && parseFloat(formAmount) > 0 && (
                              <span className="font-bold text-indigo-700">
                                {formType === "cash"
                                  ? `₱${Math.floor(parseFloat(formAmount) / selectedCoopMembers.length).toLocaleString()}`
                                  : `${Math.floor(parseInt(formAmount) / selectedCoopMembers.length)} ${formUnit}`}
                              </span>
                            )}
                          </div>
                        ))}
                        {formAmount &&
                          parseFloat(formAmount) > 0 &&
                          grantTarget === "cooperative" && (
                            <p className="text-[10px] text-indigo-500 mt-1 pt-1 border-t border-indigo-100">
                              Total:{" "}
                              {formType === "cash"
                                ? `₱${parseInt(formAmount).toLocaleString()}`
                                : `${formAmount} ${formUnit}`}{" "}
                              ÷ {selectedCoopMembers.length} ={" "}
                              {formType === "cash"
                                ? `₱${Math.floor(parseFloat(formAmount) / selectedCoopMembers.length).toLocaleString()}`
                                : `${Math.floor(parseInt(formAmount) / selectedCoopMembers.length)} ${formUnit}`}{" "}
                              each
                              {parseFloat(formAmount) %
                                selectedCoopMembers.length >
                                0 &&
                                ` (${parseFloat(formAmount) % selectedCoopMembers.length} remainder to 1st member)`}
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Grant Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFormType("cash");
                      setFormUnit("PHP");
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${formType === "cash" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => {
                      setFormType("raw_materials");
                      setFormUnit("bags");
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${formType === "raw_materials" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Raw Materials
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  {grantTarget === "cooperative" ? "Total " : ""}
                  {formType === "cash" ? "Amount (₱)" : "Quantity"}
                </label>
                <input
                  type="number"
                  placeholder={formType === "cash" ? "e.g., 10000" : "e.g., 5"}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Unit
                </label>
                <input
                  type="text"
                  placeholder={
                    formType === "cash" ? "PHP" : "bags, sacks, kilos, etc."
                  }
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Fertilizer subsidy for rice farming..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Report Cycle
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormCycle("6_months")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${formCycle === "6_months" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Every 6 Months
                  </button>
                  <button
                    onClick={() => setFormCycle("1_year")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${formCycle === "1_year" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Every 1 Year
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-slate-200 bg-white text-slate-700 py-2 px-4 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={addGrant}
                disabled={submitting}
                className="rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Plus size={14} />
                )}
                Issue Grant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARB Detail Modal */}
      {detailARB && selectedARBData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl border border-slate-200 my-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-sm uppercase text-amber-300">
                  {selectedARBData.name.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {selectedARBData.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />
                    {selectedARBData.municipality}
                    {selectedARBData.barangay
                      ? `, ${selectedARBData.barangay}`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailARB(null)}
                className="text-slate-400 hover:bg-slate-200 p-2 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-emerald-700 font-bold">
                    {getARBGrants(detailARB).length}
                  </p>
                  <p className="text-[9px] text-emerald-600 uppercase">
                    Total Grants
                  </p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-amber-700 font-bold">
                    {
                      reports.filter((r) => r.beneficiaryId === detailARB)
                        .length
                    }
                  </p>
                  <p className="text-[9px] text-amber-600 uppercase">Reports</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-700 font-bold">
                    ₱
                    {reports
                      .filter((r) => r.beneficiaryId === detailARB)
                      .reduce((s, r) => s + (r.incomeGenerated || 0), 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-[9px] text-blue-600 uppercase">
                    Total Income
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Grants Received
                </h4>
                {getARBGrants(detailARB).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No grants.</p>
                ) : (
                  <div className="space-y-2">
                    {getARBGrants(detailARB).map((g) => (
                      <div
                        key={g.id}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {g.type === "cash" ? (
                              <DollarSign
                                size={14}
                                className="text-emerald-600"
                              />
                            ) : (
                              <Package size={14} className="text-amber-600" />
                            )}
                            <span className="font-bold text-slate-700">
                              {g.type === "cash"
                                ? `₱${g.amount.toLocaleString()}`
                                : `${g.amount} ${g.unit}`}
                            </span>
                            {g.isCoopGrant && g.cooperativeName && (
                              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                                <Building2 size={9} className="inline mr-0.5" />
                                {g.cooperativeName}
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${g.status === "active" ? "bg-emerald-100 text-emerald-700" : g.status === "overdue" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                            >
                              {g.status}
                            </span>
                          </div>
                          <span className="text-slate-400">
                            {formatDate(g.dateProvided)}
                          </span>
                        </div>
                        {g.description && (
                          <p className="text-slate-500 mb-2">{g.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute -top-3 -right-3 bg-slate-800 text-white rounded-full h-8 w-8 flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

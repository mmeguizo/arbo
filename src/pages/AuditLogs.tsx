import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  formatDateTime,
  isThisMonth,
  isThisQuarter,
  exportToCSV,
} from "../utils/formatters";
import {
  ClipboardList,
  Calendar,
  User,
  ArrowRight,
  Shield,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  FileText,
} from "lucide-react";

interface AuditLog {
  id: string;
  applicationId: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  oldStatus: string | null;
  newStatus: string;
  notes: string;
}

const roleBadge = (role: string) => {
  const colors: Record<string, string> = {
    staff: "bg-orange-100 text-orange-700",
    admin: "bg-blue-100 text-blue-700",
    surveyor: "bg-emerald-100 text-emerald-700",
    arb: "bg-slate-100 text-slate-600",
  };
  return colors[role] || "bg-slate-100 text-slate-600";
};

const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    under_review: "text-orange-600",
    forwarded_to_surveyor: "text-amber-600",
    verified: "text-emerald-600",
    awarded: "text-blue-600",
    disputed: "text-rose-600",
  };
  return colors[status] || "text-slate-600";
};

export const AuditLogs: React.FC = () => {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchAppId, setSearchAppId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 20;

  // Sorting
  type SortField =
    | "timestamp"
    | "actor"
    | "actorRole"
    | "applicationId"
    | "action"
    | "newStatus";
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Admin sees all; staff/surveyor see only their own actions
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AuditLog);
        });
        setLogs(list);
        setLoading(false);
      },
      (err) => {
        console.error("Audit log snapshot error:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Scope: admin sees all, staff/surveyor see their own
  const scopedLogs = isAdmin
    ? logs
    : logs.filter(
        (l) => l.actor === profile?.name || l.actorRole === profile?.role,
      );

  // Apply all filters
  const filteredLogs = useMemo(() => {
    let result = scopedLogs;

    // Role filter
    if (filterRole !== "all")
      result = result.filter((l) => l.actorRole === filterRole);

    // App ID search
    if (searchAppId.trim())
      result = result.filter((l) =>
        l.applicationId
          .toLowerCase()
          .includes(searchAppId.trim().toLowerCase()),
      );

    // Keyword search (in notes and action)
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.notes.toLowerCase().includes(kw) ||
          l.action.toLowerCase().includes(kw) ||
          l.newStatus.toLowerCase().includes(kw) ||
          (l.oldStatus && l.oldStatus.toLowerCase().includes(kw)),
      );
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((l) => new Date(l.timestamp) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999); // end of day
      result = result.filter((l) => new Date(l.timestamp) <= to);
    }

    // Sort
    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      let aVal = String(a[sortField] || "");
      let bVal = String(b[sortField] || "");
      if (sortField === "timestamp") {
        aVal = a.timestamp;
        bVal = b.timestamp;
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return result;
  }, [
    scopedLogs,
    filterRole,
    searchAppId,
    searchKeyword,
    dateFrom,
    dateTo,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE);
  const paginatedLogs = filteredLogs.slice(page * PAGE, (page + 1) * PAGE);

  const roles = ["all", "staff", "admin", "surveyor"];

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field)
      return <ArrowUpDown size={11} className="text-slate-300 ml-1" />;
    return sortDir === "asc" ? (
      <ChevronUp size={11} className="text-emerald-700 ml-1" />
    ) : (
      <ChevronDown size={11} className="text-emerald-700 ml-1" />
    );
  };

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    exportToCSV(
      `AuditLogs_${new Date().toISOString().split("T")[0]}`,
      [
        "timestamp",
        "actor",
        "actorRole",
        "applicationId",
        "action",
        "oldStatus",
        "newStatus",
        "notes",
      ],
      filteredLogs as unknown as Record<string, unknown>[],
      {
        timestamp: "Timestamp",
        actor: "Actor",
        actorRole: "Role",
        applicationId: "Application ID",
        action: "Action",
        oldStatus: "Old Status",
        newStatus: "New Status",
        notes: "Notes",
      },
    );
  };

  // Summary stats
  const totalThisMonth = logs.filter((l) => isThisMonth(l.timestamp)).length;
  const totalThisQuarter = logs.filter((l) =>
    isThisQuarter(l.timestamp),
  ).length;
  const actionTypeCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Security & Audit
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Processing History & Audit Trail
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-700" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              All actions logged immutably
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl space-y-6">
            {/* Enhanced Filter bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={14} className="text-emerald-700" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Filters & Export
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Role filter */}
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                    Role
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setFilterRole(r);
                          setPage(0);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          filterRole === r
                            ? "bg-emerald-800 text-white border-emerald-800"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {r === "all"
                          ? "All"
                          : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range */}
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(0);
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(0);
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Search + Export */}
                <div className="space-y-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={12} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search App ID..."
                      value={searchAppId}
                      onChange={(e) => {
                        setSearchAppId(e.target.value);
                        setPage(0);
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search size={12} />
                    </div>
                    <input
                      type="text"
                      placeholder="Keyword (notes, action...)"
                      value={searchKeyword}
                      onChange={(e) => {
                        setSearchKeyword(e.target.value);
                        setPage(0);
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Export row */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400">
                  {filteredLogs.length} log
                  {filteredLogs.length !== 1 ? "s" : ""} found
                  {!isAdmin && (
                    <span className="text-emerald-600 font-bold ml-1">
                      (your transactions)
                    </span>
                  )}
                </span>
                <button
                  onClick={handleExportCSV}
                  disabled={filteredLogs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Enhanced Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Total Actions",
                  value: logs.length,
                  color: "border-l-slate-500",
                },
                {
                  label: "This Month",
                  value: totalThisMonth,
                  color: "border-l-emerald-500",
                },
                {
                  label: "This Quarter",
                  value: totalThisQuarter,
                  color: "border-l-amber-500",
                },
                {
                  label: "Staff Actions",
                  value: logs.filter((l) => l.actorRole === "staff").length,
                  color: "border-l-orange-500",
                },
                {
                  label: "Admin Actions",
                  value: logs.filter((l) => l.actorRole === "admin").length,
                  color: "border-l-blue-500",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`bg-white rounded-xl border border-slate-100 shadow-sm p-4 border-l-4 ${stat.color}`}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {stat.label}
                  </span>
                  <p className="text-xl font-extrabold text-slate-800 mt-1">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Action type breakdown (admin only) */}
            {isAdmin && Object.keys(actionTypeCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(actionTypeCounts).map(([action, count]) => (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200"
                  >
                    <FileText size={10} />
                    {action.replace(/_/g, " ")}: {count}
                  </span>
                ))}
              </div>
            )}

            {/* Log table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-emerald-700" />
                    <h2 className="text-sm font-bold text-slate-800">
                      Immutable Processing Ledger
                    </h2>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Every status change and decision is recorded here for
                    government compliance audit.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-800 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-xs text-slate-400">
                    Loading audit trail...
                  </p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 italic text-xs">
                  No audit logs match your filters. Try adjusting the date range
                  or search terms.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-left">
                        <th
                          className="py-3 px-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort("timestamp")}
                        >
                          <span className="flex items-center">
                            Timestamp <SortIcon field="timestamp" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort("actor")}
                        >
                          <span className="flex items-center">
                            Actor <SortIcon field="actor" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort("applicationId")}
                        >
                          <span className="flex items-center">
                            App ID <SortIcon field="applicationId" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider cursor-pointer hover:bg-slate-100 select-none"
                          onClick={() => handleSort("newStatus")}
                        >
                          <span className="flex items-center">
                            Status Change <SortIcon field="newStatus" />
                          </span>
                        </th>
                        <th className="py-3 px-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-6 text-xs text-slate-500 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={11} className="text-slate-300" />
                              {formatDateTime(log.timestamp)}
                            </div>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <User size={12} className="text-slate-400" />
                              <span className="text-xs font-bold text-slate-700">
                                {log.actor}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleBadge(log.actorRole)}`}
                              >
                                {log.actorRole}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-6">
                            <span className="text-xs font-mono font-bold text-slate-600">
                              {log.applicationId}
                            </span>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-1.5 text-xs">
                              {log.oldStatus && (
                                <>
                                  <span className={statusColor(log.oldStatus)}>
                                    {log.oldStatus.replace(/_/g, " ")}
                                  </span>
                                  <ArrowRight
                                    size={10}
                                    className="text-slate-300"
                                  />
                                </>
                              )}
                              <span
                                className={`font-bold ${statusColor(log.newStatus)}`}
                              >
                                {log.newStatus.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-6 max-w-xs">
                            {log.notes ? (
                              <span
                                className="text-xs text-slate-500 italic block truncate"
                                title={log.notes}
                              >
                                "{log.notes}"
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredLogs.length > PAGE && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-[10px] text-slate-400">
                    Page {page + 1} of {totalPages} ({filteredLogs.length}{" "}
                    total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

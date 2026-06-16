import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { exportToCSV, formatDate } from "../utils/formatters";
import {
  Layers,
  Users,
  FileCheck,
  Calendar,
  MapPin,
  Download,
  TrendingUp,
  Award,
  BarChart3,
  PieChart,
  ArrowUp,
} from "lucide-react";

interface LandTitleRecord {
  titleId: string;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  province: string;
  beneficiaryName: string;
  encodedAt: string;
  awardedAt?: string;
  encoderId: string;
}

interface AppRecord {
  id: string;
  status: string;
}

interface UserRecord {
  uid: string;
  role: string;
}

export const Reports: React.FC = () => {
  useAuth();
  const [landTitles, setLandTitles] = useState<LandTitleRecord[]>([]);
  const [applications, setApplications] = useState<AppRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Load data
  useEffect(() => {
    setLoading(true);

    const unsubTitles = onSnapshot(collection(db, "landTitles"), (snap) => {
      const list: LandTitleRecord[] = [];
      snap.forEach((d) => list.push(d.data() as LandTitleRecord));
      setLandTitles(list);
    });

    const unsubApps = onSnapshot(collection(db, "applications"), (snap) => {
      const list: AppRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, status: data.status || "" });
      });
      setApplications(list);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list: UserRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ uid: d.id, role: data.role || "" });
      });
      setUsers(list);
      setLoading(false);
    });

    return () => {
      unsubTitles();
      unsubApps();
      unsubUsers();
    };
  }, []);

  // Filter titles by date range
  const filteredTitles = useMemo(() => {
    let result = landTitles;
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((t) => {
        const date = new Date(t.awardedAt || t.encodedAt);
        return date >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((t) => {
        const date = new Date(t.awardedAt || t.encodedAt);
        return date <= to;
      });
    }
    return result;
  }, [landTitles, dateFrom, dateTo]);

  // KPI calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(currentMonth / 3);

  const awardedThisMonth = landTitles.filter((t) => {
    const d = new Date(t.awardedAt || t.encodedAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const awardedThisQuarter = landTitles.filter((t) => {
    const d = new Date(t.awardedAt || t.encodedAt);
    return (
      Math.floor(d.getMonth() / 3) === currentQuarter &&
      d.getFullYear() === currentYear
    );
  }).length;

  const awardedThisYear = landTitles.filter((t) => {
    const d = new Date(t.awardedAt || t.encodedAt);
    return d.getFullYear() === currentYear;
  }).length;

  const totalFarmers = users.filter((u) => u.role === "arb").length;
  const totalHectares = landTitles.reduce(
    (sum, t) => sum + Number(t.areaHectares || 0),
    0,
  );
  const totalAwarded = applications.filter(
    (a) => a.status === "awarded",
  ).length;

  // Monthly awards chart data (current year)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const count = landTitles.filter((t) => {
        const d = new Date(t.awardedAt || t.encodedAt);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      }).length;
      const name = new Date(currentYear, i).toLocaleDateString("en-US", {
        month: "short",
      });
      return { name, count, month: i };
    });
    return months;
  }, [landTitles, currentYear]);

  const maxMonthlyCount = Math.max(...monthlyData.map((m) => m.count), 1);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statuses = ["under_review", "verified", "awarded", "disputed"];
    const labels: Record<string, string> = {
      under_review: "Under Review",
      verified: "Verified",
      awarded: "Awarded",
      disputed: "Disputed",
    };
    const colors: Record<string, string> = {
      under_review: "#f97316",
      verified: "#10b981",
      awarded: "#2563eb",
      disputed: "#e11d48",
    };
    return statuses.map((s) => ({
      key: s,
      label: labels[s],
      count: applications.filter((a) => a.status === s).length,
      color: colors[s],
    }));
  }, [applications]);

  const totalStatusCounts = statusDistribution.reduce((s, d) => s + d.count, 0);

  // Top municipalities
  const municipalityData = useMemo(() => {
    const map = new Map<string, number>();
    landTitles.forEach((t) => {
      const m = t.municipality || "Unknown";
      map.set(m, (map.get(m) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [landTitles]);

  const maxMunCount = Math.max(...municipalityData.map((m) => m.count), 1);

  // Export handlers
  const exportMonthlyData = () => {
    exportToCSV(
      "Monthly_Awards",
      ["month", "count"],
      monthlyData.map((m) => ({ month: m.name, count: m.count })),
      { month: "Month", count: "Titles Awarded" },
    );
  };

  const exportStatusData = () => {
    exportToCSV(
      "Status_Distribution",
      ["status", "count"],
      statusDistribution.map((s) => ({ status: s.label, count: s.count })),
      { status: "Status", count: "Applications" },
    );
  };

  const exportMunicipalityData = () => {
    exportToCSV(
      "Top_Municipalities",
      ["municipality", "count"],
      municipalityData.map((m) => ({ municipality: m.name, count: m.count })),
      { municipality: "Municipality", count: "Titles" },
    );
  };

  const exportTitlesTable = () => {
    if (filteredTitles.length === 0) return;
    exportToCSV(
      `Land_Titles_${new Date().toISOString().split("T")[0]}`,
      [
        "titleNumber",
        "lotNumber",
        "areaHectares",
        "municipality",
        "province",
        "beneficiaryName",
        "awardedAt",
        "encodedAt",
        "encoderId",
      ],
      filteredTitles as unknown as Record<string, unknown>[],
      {
        titleNumber: "Title Number",
        lotNumber: "Lot Number",
        areaHectares: "Area (ha)",
        municipality: "Municipality",
        province: "Province",
        beneficiaryName: "Beneficiary",
        awardedAt: "Awarded Date",
        encodedAt: "Encoded Date",
        encoderId: "Encoder",
      },
    );
  };

  // Donut chart: CSS conic-gradient
  const donutStyle = useMemo(() => {
    if (totalStatusCounts === 0) return {};
    let cumulative = 0;
    const parts = statusDistribution
      .filter((s) => s.count > 0)
      .map((s) => {
        const pct = (s.count / totalStatusCounts) * 100;
        const start = cumulative;
        cumulative += pct;
        return `${s.color} ${start}% ${cumulative}%`;
      });
    return {
      background: `conic-gradient(${parts.join(", ")})`,
    };
  }, [statusDistribution, totalStatusCounts]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Analytics & Reporting
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Land Distribution Reports
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <BarChart3 size={14} className="text-emerald-700" />
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Live Data
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 space-y-8 max-w-7xl">
          {/* === KPI Cards Row === */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Awarded This Month
                </span>
                <Calendar size={16} className="text-emerald-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900">
                {awardedThisMonth}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <ArrowUp size={12} className="text-emerald-600" />
                Titles awarded in{" "}
                {now.toLocaleDateString("en-US", { month: "long" })}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  This Quarter
                </span>
                <Award size={16} className="text-amber-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900">
                {awardedThisQuarter}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Q{currentQuarter + 1} {currentYear}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Awarded This Year
                </span>
                <TrendingUp size={16} className="text-blue-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900">
                {awardedThisYear}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {currentYear} total
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Farmers
                </span>
                <Users size={16} className="text-indigo-600" />
              </div>
              <p className="text-3xl font-extrabold text-slate-900">
                {totalFarmers}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">ARBs registered</p>
            </div>
          </div>

          {/* Secondary KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 shadow-sm p-5 text-left">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <Layers size={14} />
                Total Land Area Awarded
              </span>
              <p className="text-2xl font-extrabold text-emerald-900 mt-1">
                {totalHectares.toFixed(1)} ha
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm p-5 text-left">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <FileCheck size={14} />
                Total CLOA Titles
              </span>
              <p className="text-2xl font-extrabold text-blue-900 mt-1">
                {landTitles.length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 shadow-sm p-5 text-left">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <Award size={14} />
                Total Awarded Applications
              </span>
              <p className="text-2xl font-extrabold text-amber-900 mt-1">
                {totalAwarded}
              </p>
            </div>
          </div>

          {/* === Charts Row === */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Bar Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <BarChart3 size={16} className="text-emerald-700" />
                    Monthly Awards Trend
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {currentYear}
                  </p>
                </div>
                <button
                  onClick={exportMonthlyData}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  Export
                </button>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1.5 h-32">
                {monthlyData.map((m) => {
                  const height = (m.count / maxMonthlyCount) * 100;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.count}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-emerald-600 hover:bg-emerald-700 transition-colors"
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${m.name}: ${m.count}`}
                      ></div>
                      <span className="text-[8px] text-slate-400">
                        {m.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Distribution Donut */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <PieChart size={16} className="text-emerald-700" />
                    Application Status Distribution
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    All applications
                  </p>
                </div>
                <button
                  onClick={exportStatusData}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  Export
                </button>
              </div>

              {totalStatusCounts > 0 ? (
                <div className="flex items-center gap-6">
                  {/* Donut */}
                  <div
                    className="h-28 w-28 rounded-full shrink-0 border-4 border-white shadow-md"
                    style={donutStyle}
                  ></div>
                  {/* Legend */}
                  <div className="space-y-1.5">
                    {statusDistribution.map((s) => (
                      <div
                        key={s.key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        ></div>
                        <span className="text-slate-600">{s.label}</span>
                        <span className="font-bold text-slate-800">
                          {s.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-6 text-center">
                  No application data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Top Municipalities Bar Chart */}
          {municipalityData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin size={16} className="text-emerald-700" />
                    Top Municipalities by Awarded Titles
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Top 10 municipalities
                  </p>
                </div>
                <button
                  onClick={exportMunicipalityData}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-1.5 px-3 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  Export
                </button>
              </div>

              <div className="space-y-3">
                {municipalityData.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 w-32 truncate shrink-0">
                      {m.name}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{
                          width: `${(m.count / maxMunCount) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right shrink-0">
                      {m.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Filterable Titles Table === */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCheck size={16} className="text-emerald-700" />
                    Awarded Land Titles Registry
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {filteredTitles.length} title
                    {filteredTitles.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={exportTitlesTable}
                    disabled={filteredTitles.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-800 border-t-transparent mx-auto mb-3"></div>
                <p className="text-xs text-slate-400">Loading registry...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left">Title #</th>
                      <th className="px-6 py-4 text-left">Beneficiary</th>
                      <th className="px-6 py-4 text-left">Lot #</th>
                      <th className="px-6 py-4 text-left">Area (ha)</th>
                      <th className="px-6 py-4 text-left">Municipality</th>
                      <th className="px-6 py-4 text-left">Awarded Date</th>
                      <th className="px-6 py-4 text-left">Encoder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTitles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-slate-400 italic text-xs"
                        >
                          No titles match the selected date range.
                        </td>
                      </tr>
                    ) : (
                      filteredTitles.map((t) => (
                        <tr
                          key={t.titleId}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-extrabold text-slate-800 whitespace-nowrap">
                            {t.titleNumber}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">
                            {t.beneficiaryName}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {t.lotNumber}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-800">
                            {t.areaHectares}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {t.municipality}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(t.awardedAt || t.encodedAt)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {t.encoderId}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

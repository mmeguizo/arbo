import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import { collection, query, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Users,
  Layers,
  MapPin,
  Search,
  FileCheck,
  AlertCircle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

interface Stats {
  totalFarmers: number;
  totalLandsHectares: number;
  activeTitles: number;
}

interface AppRecord {
  id: string;
  userName: string;
  userBarangay: string;
  userMunicipality: string;
  userProvince: string;
  status: ApplicationStatus;
  submittedAt: string;
}

interface LandTitle {
  titleId: string;
  applicationId: string;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  province: string;
  geoLat: string;
  geoLng: string;
  encodedAt: string;
}

type SortField = "userName" | "userBarangay" | "status" | "submittedAt";
type SortDir = "asc" | "desc";

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalFarmers: 0,
    totalLandsHectares: 0,
    activeTitles: 0,
  });
  const [applications, setApplications] = useState<AppRecord[]>([]);
  const [landTitles, setLandTitles] = useState<LandTitle[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Modal State
  const [selectedApp, setSelectedApp] = useState<AppRecord | null>(null);

  // Load live values from Firestore using onSnapshot
  useEffect(() => {
    setLoading(true);

    // 1. Listen to Farmers count
    const qUsers = query(collection(db, "users"), where("role", "==", "arb"));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setStats((prev) => ({ ...prev, totalFarmers: snap.size }));
    });

    // 2. Listen to Land Titles (for stats and modal lookups)
    const unsubTitles = onSnapshot(collection(db, "landTitles"), (snap) => {
      let sumHectares = 0;
      const titles: LandTitle[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as LandTitle;
        sumHectares += Number(data.areaHectares || 0);
        titles.push(data);
      });
      setStats((prev) => ({
        ...prev,
        activeTitles: snap.size,
        totalLandsHectares: Number(sumHectares.toFixed(1)),
      }));
      setLandTitles(titles);
    });

    // 3. Listen to Applications Registry (limited to 100 for scalability)
    const qApps = query(collection(db, "applications"), orderBy("submittedAt", "desc"), limit(100));
    const unsubApps = onSnapshot(qApps, (snap) => {
      const appList: AppRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        appList.push({
          id: d.id,
          userName: data.userName || "Unknown",
          userBarangay: data.userBarangay || "—",
          userMunicipality: data.userMunicipality || "",
          userProvince: data.userProvince || "",
          status: data.status as ApplicationStatus,
          submittedAt: data.submittedAt || "",
        });
      });
      setApplications(appList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching applications:", error);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubTitles();
      unsubApps();
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");

    if (!searchQuery.trim()) {
      setSearchError("Please input an OCT/TCT title number.");
      return;
    }

    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedApplications = [...applications].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aVal = a[sortField] || "";
    const bVal = b[sortField] || "";
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field)
      return <ArrowUpDown size={12} className="text-slate-300 ml-1" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="text-emerald-700 ml-1" />
    ) : (
      <ChevronDown size={12} className="text-emerald-700 ml-1" />
    );
  };

  const selectedTitle = selectedApp ? landTitles.find((t) => t.applicationId === selectedApp.id) : null;

  // Staff-specific dashboard
  if (profile?.role === "staff") {
    const underReviewCount = applications.filter(a => a.status === "under_review").length;
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-y-auto">
          <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 m-0">
              Staff Workspace
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Logged as DAR Staff
            </p>
          </header>
          <main className="p-8 max-w-4xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Welcome, {profile?.name}
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                You are logged in as a DAR Staff member. Review ARB applications,
                verify documents, and forward qualified applicants to the Admin for final approval.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Under Review</span>
                  <p className="text-2xl font-extrabold text-orange-900 mt-1">{underReviewCount}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Admin</span>
                  <p className="text-2xl font-extrabold text-amber-900 mt-1">{applications.filter(a => a.status === "pending").length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Resolved</span>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-1">{applications.filter(a => a.status === "verified" || a.status === "awarded").length}</p>
                </div>
              </div>
              <Link
                to="/review-apps"
                className="inline-flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-6 text-sm font-semibold text-white transition-all shadow-md cursor-pointer"
              >
                <span>Go to Review Applications</span>
                <FileText size={16} />
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Surveyor-specific dashboard
  if (profile?.role === "surveyor") {
    const awardedCount = applications.filter(a => a.status === "awarded").length;
    const totalTitles = landTitles.length;
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-y-auto">
          <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 m-0">
              Surveyor Workspace
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Logged as DAR Surveyor
            </p>
          </header>
          <main className="p-8 max-w-4xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Welcome, {profile?.name}
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Encode land title information for approved ARB applicants.
                Verify GPS coordinates and register title numbers in the system.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Verified (Ready)</span>
                  <p className="text-2xl font-extrabold text-indigo-900 mt-1">{applications.filter(a => a.status === "verified").length}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Awarded (Done)</span>
                  <p className="text-2xl font-extrabold text-blue-900 mt-1">{awardedCount}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Titles</span>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-1">{totalTitles}</p>
                </div>
              </div>
              <Link
                to="/land-titles"
                className="inline-flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-6 text-sm font-semibold text-white transition-all shadow-md cursor-pointer"
              >
                <span>Go to Land Title Entry</span>
                <MapPin size={16} />
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ARB-specific dashboard
  if (profile?.role === "arb") {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-y-auto">
          <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 m-0">
              My Workspace
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Logged as Farmer (ARB)
            </p>
          </header>

          <main className="p-8 max-w-4xl">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Welcome, {profile?.name}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                You are registered as an Agrarian Reform Beneficiary. Use the
                link below to track your CLOA application profile, submit
                additional documentation, or review your awarded Land Titles
                once confirmed by DAR officers.
              </p>

              <Link
                to="/my-application"
                className="inline-flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-6 text-sm font-semibold text-white transition-all shadow-md cursor-pointer"
              >
                <span>Track My Application</span>
                <Layers size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 bg-emerald-50/40 rounded-xl p-5 text-left">
                <h3 className="font-bold text-sm text-emerald-900 mb-1">
                  Land Verification Details
                </h3>
                <p className="text-xs text-slate-650 leading-relaxed">
                  Your designated land Surveyor encodes exact geographic lot
                  details, including coordinates and hectarage, directly linked
                  to your profile upon review.
                </p>
              </div>
              <div className="border border-slate-200 bg-amber-50/40 rounded-xl p-5 text-left">
                <h3 className="font-bold text-sm text-amber-900 mb-1">
                  Official Requirements
                </h3>
                <p className="text-xs text-slate-650 leading-relaxed">
                  Required credentials for submission include your Cedula, Birth
                  Certificate, Barangay Certificate, and continuous 10-year
                  residency documentation.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Department of Agrarian Reform
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              DAR PH Portal
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 m-0">
                {profile?.name || "Officer"}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-semibold m-0">
                {profile?.role || "Administrator"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-base uppercase text-amber-300 border border-slate-100">
              {profile?.name ? profile.name.substring(0, 2) : "AD"}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 space-y-8">
          {/* Welcome Dashboard Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white rounded-2xl p-6 border border-slate-100 shadow-sm gap-4">
            <div className="text-left">
              <h2 className="text-xl font-extrabold text-slate-900 m-0">
                Dashboard Overview
              </h2>
              <p className="text-xs text-slate-500 mt-1 m-0">
                Welcome, {profile?.name || "Officer"}. Tracking land
                distribution indicators and analytics.
              </p>
            </div>
            <div className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl flex items-center space-x-2 border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></div>
              <span>Live Registry</span>
            </div>
          </div>

          {/* Top Numeric Cards block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Lands Cultivated */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Lands Cultivated
                </span>
                <h3 className="text-3xl font-extrabold text-slate-900">
                  {stats.totalLandsHectares}ha
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  {stats.totalFarmers} Farmers Registered
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                <Layers size={22} />
              </div>
            </div>

            {/* Card 2: Registered ARBs */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active ARBs Registered
                </span>
                <h3 className="text-3xl font-extrabold text-slate-900">
                  {stats.totalFarmers}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Total Municipalities
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Users size={22} />
              </div>
            </div>

            {/* Card 3: Active Titles Distributed */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active CLOA Titles
                </span>
                <h3 className="text-3xl font-extrabold text-slate-900">
                  {stats.activeTitles}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Land titles encoded by surveyors
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <FileCheck size={22} />
              </div>
            </div>
          </div>

          {/* Middle: Quick Search + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick OCT/TCT Land Verification block */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Land Title Verification
              </h3>
              <p className="text-[10px] text-slate-400 mb-6">
                Instantly check status of OCT/TCT application
              </p>

              <form onSubmit={handleSearchSubmit} className="space-y-4 my-auto">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                     OCT/TCT Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="TCT-123456"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>

                {searchError && (
                  <p className="text-xs text-rose-650 flex items-center space-x-1 font-semibold">
                    <AlertCircle size={14} />
                    <span>{searchError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-4 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <Search size={14} />
                  <span>Search Registry</span>
                </button>
              </form>
            </div>

            {/* Status Distribution Summary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Application Status Distribution
              </h3>
              <p className="text-[10px] text-slate-400 mb-6">
                Current breakdown of recent ARB applications by stage
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {([
                  { key: "under_review", label: "Under Review", color: "bg-orange-500" },
                  { key: "pending", label: "Pending (Admin)", color: "bg-amber-500" },
                  { key: "verified", label: "Verified", color: "bg-emerald-500" },
                  { key: "awarded", label: "Awarded", color: "bg-blue-500" },
                  { key: "disputed", label: "Disputed", color: "bg-rose-500" },
                ] as const).map((item) => {
                  const count = applications.filter(
                    (a) => a.status === item.key,
                  ).length;
                  return (
                    <div
                      key={item.key}
                      className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center"
                    >
                      <div className="flex items-center justify-center space-x-1.5 mb-2">
                        <div className={`h-2 w-2 rounded-full ${item.color}`}></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-2xl font-extrabold text-slate-900">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Applications Registry Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-left overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Applications Registry
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Latest 100 applications — click row to view details
                </p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {applications.length} Limit
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-slate-550 uppercase tracking-widest text-[9px] font-bold">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort("userName")}
                    >
                      <span className="flex items-center">
                        Beneficiary Name
                        <SortIcon field="userName" />
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort("userBarangay")}
                    >
                      <span className="flex items-center">
                        Barangay
                        <SortIcon field="userBarangay" />
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort("status")}
                    >
                      <span className="flex items-center">
                        Status
                        <SortIcon field="status" />
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => handleSort("submittedAt")}
                    >
                      <span className="flex items-center">
                        Submitted Date
                        <SortIcon field="submittedAt" />
                      </span>
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Province
                    </th>
                    <th scope="col" className="px-6 py-4">
                      App ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-slate-400"
                      >
                        <div className="flex flex-col items-center space-y-2">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent"></div>
                          <span className="text-xs font-semibold">
                            Loading registry...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedApplications.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-slate-400 italic"
                      >
                        No application records found yet.
                      </td>
                    </tr>
                  ) : (
                    sortedApplications.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedApp(item)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                          {item.userName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 text-slate-500">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{item.userBarangay}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap text-xs">
                          {item.submittedAt
                            ? new Date(item.submittedAt).toLocaleDateString(
                                "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          {item.userProvince || "Negros Occidental"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                          {item.id}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Registry Title Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden text-left border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Registry Profile</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedApp.id}</p>
              </div>
              <button 
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 px-3 py-1 rounded text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">{selectedApp.userName}</h2>
                  <p className="text-sm text-slate-500 flex items-center mt-1">
                    <MapPin size={14} className="mr-1"/>
                    {selectedApp.userBarangay}
                    {(selectedApp.userMunicipality || selectedApp.userProvince) && (
                      <span className="ml-1 text-slate-400">
                        — {selectedApp.userMunicipality && `${selectedApp.userMunicipality}`}
                        {selectedApp.userMunicipality && selectedApp.userProvince && ", "}
                        {selectedApp.userProvince}
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge status={selectedApp.status} />
              </div>

              {selectedTitle ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-3">CLOA Title Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Title Number</span>
                        <span className="font-mono font-bold text-slate-900">{selectedTitle.titleNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Lot Number</span>
                        <span className="font-bold text-slate-900">{selectedTitle.lotNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Land Area</span>
                        <span className="font-bold text-slate-900 flex items-center">
                          <Layers size={14} className="text-emerald-700 mr-1"/>
                          {selectedTitle.areaHectares} Hectares
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Municipality</span>
                        <span className="font-bold text-slate-900 flex items-center">
                          <MapPin size={14} className="text-emerald-700 mr-1"/>
                          {selectedTitle.municipality}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Province</span>
                        <span className="font-bold text-slate-900 flex items-center">
                          <MapPin size={14} className="text-emerald-700 mr-1"/>
                          {(selectedTitle as any).province || "Negros Occidental"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">GPS Coordinates</span>
                      <span className="font-mono bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                        {selectedTitle.geoLat}, {selectedTitle.geoLng}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-6 text-center text-sm">
                  <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="font-semibold">No Land Title Encoded Yet</p>
                  <p className="text-xs mt-1 opacity-80">This application is currently in the {selectedApp.status.replace("_", " ")} stage. A surveyor must verify and encode the title boundaries to generate a CLOA record.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedApp(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

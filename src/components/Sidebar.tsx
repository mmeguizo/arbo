import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Helper to check active state
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const getNavItems = () => {
    const role = profile?.role;

    if (role === "arb") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "My CLOA Record", path: "/my-application", icon: FileText },
      ];
    }

    if (role === "staff") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "Review Applications", path: "/review-apps", icon: FileText },
        { label: "Search Registry", path: "/search", icon: Search },
        { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
      ];
    }

    if (role === "surveyor") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "Encode Title Info", path: "/land-titles", icon: MapPin },
        { label: "Search Registry", path: "/search", icon: Search },
        { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
      ];
    }

    if (role === "admin") {
      return [
        { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
        { label: "Review (Staff Stage)", path: "/review-apps", icon: FileText },
        { label: "Surveyor Stage", path: "/land-titles", icon: MapPin },
        { label: "Search Registry", path: "/search", icon: Search },
        { label: "Analytics & Reports", path: "/reports", icon: TrendingUp },
        { label: "System Users", path: "/accounts", icon: Settings },
        { label: "Audit Logs", path: "/audit-logs", icon: ClipboardList },
      ];
    }

    // No profile loaded yet — return empty nav rather than exposing /dashboard
    return [];
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-emerald-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-emerald-900 font-bold text-xs p-1">
            <span className="text-stone-900">DAR</span>
          </div>
          <span className="font-bold tracking-wider">DAR Portal</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-white focus:outline-none"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar container */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-emerald-900 text-white transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col md:min-h-screen ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header Logo */}
        <div className="flex items-center space-x-3 px-6 py-6 border-b border-emerald-800">
          <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center p-1 font-bold text-slate-800 shadow-md">
            {/* Simple DAR designator */}
            <div className="text-center">
              <p className="text-[10px] leading-3 font-extrabold text-emerald-800">
                DAR
              </p>
              <p className="text-[8px] leading-3 font-semibold text-amber-500">
                PH
              </p>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight m-0 text-white">
              DAR PH
            </h1>
            <p className="text-[10px] text-emerald-200 uppercase tracking-widest leading-3 m-0">
              {profile?.province || "Negros Occidental"}
            </p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors group ${
                  active
                    ? "bg-emerald-700 text-white font-semibold"
                    : "text-emerald-100 hover:bg-emerald-800/50 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    size={18}
                    className={
                      active
                        ? "text-amber-400"
                        : "text-emerald-200 group-hover:text-amber-300"
                    }
                  />
                  <span>{item.label}</span>
                </div>
                {active && (
                  <ChevronRight size={14} className="text-amber-400" />
                )}
              </Link>
            );
          })}

          {/* Add a placeholder greyed out Profitability Tracking representing future scope so the layout is faithful to the mockup */}
          <div className="border-t border-emerald-800/60 my-4 pt-4">
            <div className="flex items-center space-x-3 px-4 py-2 opacity-50 cursor-not-allowed">
              <TrendingUp size={18} className="text-emerald-200" />
              <div className="text-left">
                <span className="text-xs font-semibold block text-emerald-100">
                  Profitability Tracking
                </span>
                <span className="text-[9px] bg-emerald-800 text-amber-400 px-1 py-0.5 rounded uppercase font-bold">
                  Future Scope
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-emerald-800/80 bg-emerald-950/40">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-sm uppercase text-amber-300">
              {profile?.name ? profile.name.substring(0, 2) : "US"}
            </div>
            <div className="truncate text-left">
              <p className="text-xs font-bold text-slate-100 max-w-37.5 truncate m-0">
                {profile?.name || "User"}
              </p>
              <p className="text-[10px] text-emerald-300 uppercase font-medium tracking-wide m-0">
                {profile?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-medium text-emerald-200 hover:bg-red-900/40 hover:text-red-200 transition-colors bg-emerald-950"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden"
        ></div>
      )}
    </>
  );
};

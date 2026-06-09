import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  useNotifications,
  type Notification,
} from "../contexts/NotificationContext";
import { Bell, CheckCheck } from "lucide-react";

export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getNotificationRoute = (n: Notification): string => {
    const role = profile?.role;
    // Admin: routes to verified (Admin Stage) tab
    if (role === "admin") {
      return "/review-apps?tab=verified";
    }
    // Staff: routes to under_review (Staff Stage) tab
    if (role === "staff") {
      return "/review-apps?tab=under_review";
    }
    // Surveyor: forwarded/correction go to land-titles
    if (role === "surveyor") {
      if (n.type === "forwarded" || n.type === "correction_needed") {
        return "/land-titles";
      }
      return "/land-titles";
    }
    // ARB
    if (role === "arb") {
      return "/my-application";
    }
    return "/dashboard";
  };

  const handleClickNotification = async (n: Notification) => {
    await markAsRead(n.id);
    setOpen(false);
    const route = getNotificationRoute(n);
    navigate(route);
  };

  const latest = notifications.slice(0, 10);

  // Calculate dropdown position relative to the button
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown to the right of the sidebar (left edge of bell), not from window right
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 384;
      const upward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      setDropdownStyle({
        position: "fixed",
        left: rect.left + 8,
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        zIndex: 99999,
      });
    }
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg hover:bg-emerald-800/50 transition-colors text-emerald-200 hover:text-white cursor-pointer"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div ref={dropdownRef} style={dropdownStyle} className="shadow-2xl">
            <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-1 text-emerald-600">
                      ({unreadCount} new)
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      await markAllAsRead();
                    }}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {latest.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400 italic">
                    No notifications yet.
                  </div>
                ) : (
                  latest.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleClickNotification(n)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !n.read ? "bg-emerald-50/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.read && (
                          <span className="shrink-0 mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 leading-snug">
                            {n.title}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed truncate">
                            {n.message}
                          </p>
                          <p className="text-[9px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 10 && (
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400">
                    +{notifications.length - 10} more notifications
                  </span>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

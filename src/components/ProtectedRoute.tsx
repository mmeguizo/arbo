import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const getDefaultRoute = (role?: UserRole) => {
  if (role === "arb") {
    return "/my-application";
  }

  return "/dashboard";
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-dar-green border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-600">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Profile not yet resolved after auth (race condition window after registration).
  // Show a spinner instead of rendering children with no profile — prevents an ARB
  // user from accidentally seeing the Admin Dashboard during this brief window.
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-dar-green border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-600">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  // Check if account has been explicitly disabled by an Admin
  if (profile.isActive === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-rose-200 p-8 text-center space-y-4">
          <div className="h-16 w-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
              <line x1="12" y1="2" x2="12" y2="12"></line>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Account Disabled</h2>
          <p className="text-sm text-slate-500 pb-2">
            Your access has been suspended or revoked by the DAR Administrator. 
            Please contact your district officer for further assistance.
          </p>
          <button 
            onClick={() => logout()}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={getDefaultRoute(profile.role)} replace />;
  }

  return <>{children}</>;
};

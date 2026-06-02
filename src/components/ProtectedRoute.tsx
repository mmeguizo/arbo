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
  const { user, profile, loading } = useAuth();

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

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={getDefaultRoute(profile.role)} replace />;
  }

  return <>{children}</>;
};

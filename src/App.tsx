import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Pages
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { MyApplication } from "./pages/MyApplication";
import { ReviewApps } from "./pages/ReviewApps";
import { LandTitles } from "./pages/LandTitles";
import { Search } from "./pages/Search";
import { AdminUsers } from "./pages/AdminUsers";
import { AuditLogs } from "./pages/AuditLogs";
import { Reports } from "./pages/Reports";
import { MyGrants } from "./pages/MyGrants";
import { GrantManagement } from "./pages/GrantManagement";
import { CooperativeManagement } from "./pages/CooperativeManagement";
import { ArboDashboard } from "./pages/ArboDashboard";
import { TrainingManagement } from "./pages/TrainingManagement";
import { MyTrainings } from "./pages/MyTrainings";

// A small gatekeeper component that routes authenticated users to their natural landing page
const AuthRedirect: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Route based on role
  if (profile?.role === "arb") {
    return <Navigate to="/my-application" replace />;
  }

  if (profile?.role === "arbo_head") {
    return <Navigate to="/arbo-dashboard" replace />;
  }

  // Official roles go to Admin/Staff/Encoder Dashboard
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "staff", "encoder", "arb"]}
                >
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-application"
              element={
                <ProtectedRoute allowedRoles={["arb"]}>
                  <MyApplication />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-grants"
              element={
                <ProtectedRoute allowedRoles={["arb"]}>
                  <MyGrants />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-trainings"
              element={
                <ProtectedRoute allowedRoles={["arb", "arbo_head"]}>
                  <MyTrainings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/review-apps"
              element={
                <ProtectedRoute allowedRoles={["admin", "staff"]}>
                  <ReviewApps />
                </ProtectedRoute>
              }
            />

            <Route
              path="/land-titles"
              element={
                <ProtectedRoute allowedRoles={["encoder", "admin"]}>
                  <LandTitles />
                </ProtectedRoute>
              }
            />

            <Route
              path="/search"
              element={
                <ProtectedRoute allowedRoles={["admin", "staff", "encoder"]}>
                  <Search />
                </ProtectedRoute>
              }
            />

            <Route
              path="/accounts"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            <Route
              path="/grants"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <GrantManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/cooperatives"
              element={
                <ProtectedRoute allowedRoles={["admin", "staff"]}>
                  <CooperativeManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/arbo-dashboard"
              element={
                <ProtectedRoute allowedRoles={["arbo_head"]}>
                  <ArboDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/trainings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <TrainingManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["admin", "staff", "encoder"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            {/* Wildcard Fallback redirection */}
            <Route path="*" element={<AuthRedirect />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

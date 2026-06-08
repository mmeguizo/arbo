import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase/config";
import {
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }
    setResetLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch (err: any) {
      console.error("Login failure: ", err);
      if (err.code === "auth/user-not-found") {
        setError(
          "No account found with this email. Please create an account first.",
        );
      } else if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Invalid password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left branding pane - visible on desktop */}
      <div className="hidden w-1/2 flex-col justify-between bg-emerald-900 p-12 text-white lg:flex relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-800 opacity-40"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-emerald-800 opacity-40"></div>

        <div className="flex items-center space-x-3 z-10">
          <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center p-1 font-bold text-slate-800 shadow-md">
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
            <span className="text-lg font-bold tracking-wider text-white">
              DAR PH Portal
            </span>
            <p className="text-[10px] text-emerald-200 tracking-widest leading-3 m-0">
              Negros Occidental &amp; Oriental
            </p>
          </div>
        </div>

        <div className="space-y-4 my-auto z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-white leading-10">
            Resilient Agrarian Communities in Negros
          </h2>
          <p className="text-emerald-100 max-w-lg leading-relaxed text-sm">
            Empowering Agrarian Reform Beneficiaries (ARBs) across Negros
            Occidental and Negros Oriental through transparent, streamlined, and
            structured digital land title processing and tracking.
          </p>
        </div>

        <div className="border-t border-emerald-800 pt-6 z-10">
          <p className="text-xs text-emerald-300">
            &copy; {new Date().getFullYear()} Department of Agrarian Reform,
            Negros Occidental &amp; Oriental. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Login Form pane */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-24 bg-slate-50">
        <div className="mx-auto w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome Back
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to manage your DAR account and land records
            </p>
          </div>

          {resetSent && (
            <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
              <KeyRound size={18} className="shrink-0 mt-0.5" />
              <span className="font-semibold">
                Password reset email sent! Check your inbox.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-500">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline transition-colors disabled:opacity-50"
                >
                  <KeyRound size={12} className="inline mr-0.5" />
                  Forgot Password?
                </button>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-800 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3.5 px-4 text-sm font-semibold text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/10 cursor-pointer mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-600">
              Are you an Agrarian Reform Beneficiary (ARB)?{" "}
              <Link
                to="/register"
                className="font-semibold text-emerald-800 hover:underline"
              >
                Create an Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

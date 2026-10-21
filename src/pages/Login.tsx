import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { broadcastNotification } from "../contexts/NotificationContext";
import {
  createAndSendOtp,
  verifyOtpCode,
  canResendOtp,
} from "../services/otpService";
import {
  LogIn,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  RotateCw,
  Info,
} from "lucide-react";

export const Login: React.FC = () => {
  const { user, isOtpVerified, setSessionOtpVerified, logout } = useAuth();
  const navigate = useNavigate();

  // Authentication & Flow state
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // OTP specific state
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(600); // 10 minutes
  const [devOtpBanner, setDevOtpBanner] = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string>("");
  const [pendingEmail, setPendingEmail] = useState<string>("");

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If user arrives while already authenticated in Firebase but not OTP-verified
  useEffect(() => {
    if (user && !isOtpVerified) {
      setStep("otp");
      setPendingUid(user.uid);
      setPendingEmail(user.email || "");
      // Trigger OTP dispatch if not already initiated
      triggerOtpSend(user.uid, user.email || "");
    }
  }, [user, isOtpVerified]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // OTP Expiration timer
  useEffect(() => {
    if (step !== "otp" || expirySeconds <= 0) return;
    const interval = setInterval(() => {
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, expirySeconds]);

  // Mask email for display: "john.doe@example.com" -> "j***e@example.com"
  const maskEmail = (str: string): string => {
    if (!str || !str.includes("@")) return str;
    const [name, domain] = str.split("@");
    if (name.length <= 2) {
      return `${name[0]}*@${domain}`;
    }
    return `${name[0]}${"*".repeat(Math.max(name.length - 2, 3))}${name[name.length - 1]}@${domain}`;
  };

  const triggerOtpSend = async (uid: string, targetEmail: string) => {
    setError(null);
    const result = await createAndSendOtp(uid, targetEmail);
    if (!result.success) {
      setError(result.error || "Failed to dispatch verification code.");
      return;
    }

    setResendCooldown(60);
    setExpirySeconds(600);
    if (result.isDevMode && result.devOtp) {
      setDevOtpBanner(result.devOtp);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }
    setResetLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      await broadcastNotification(
        "admin",
        "password_reset_requested",
        "Password Reset Requested",
        `${email.trim()} requested a password reset. The Firebase reset email was sent; please follow up if the user needs assistance.`
      );
      setResetSent(true);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const targetUid = userCredential.user.uid;
      const targetEmail = userCredential.user.email || email.trim();
      setPendingUid(targetUid);
      setPendingEmail(targetEmail);

      // Step 2: Trigger OTP generation & dispatch
      await triggerOtpSend(targetUid, targetEmail);
      setStep("otp");
    } catch (err: any) {
      console.error("Login failure: ", err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError(
          "Invalid email or password. Please double-check your credentials."
        );
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, "");
    if (!cleanVal) {
      const updated = [...otpDigits];
      updated[index] = "";
      setOtpDigits(updated);
      return;
    }

    const digit = cleanVal.slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance to next input cell
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const updated = [...otpDigits];
    for (let i = 0; i < pastedData.length; i++) {
      updated[i] = pastedData[i];
    }
    setOtpDigits(updated);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const enteredCode = otpDigits.join("");

    if (enteredCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError(null);
    setOtpLoading(true);

    try {
      const result = await verifyOtpCode(pendingUid, enteredCode);
      if (!result.success) {
        setError(result.error || "Verification failed. Please try again.");
        return;
      }

      // Mark session verified in AuthContext and sessionStorage
      setSessionOtpVerified(true);
      navigate("/");
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError("An unexpected error occurred while verifying the code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);

    const check = await canResendOtp(pendingUid);
    if (!check.allowed) {
      setResendCooldown(check.waitSeconds || 60);
      setError(`Please wait ${check.waitSeconds}s before requesting another code.`);
      return;
    }

    setOtpDigits(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
    await triggerOtpSend(pendingUid, pendingEmail);
  };

  const handleCancelOtp = async () => {
    // Logout Firebase user and return to credentials step
    await logout();
    setStep("credentials");
    setOtpDigits(["", "", "", "", "", ""]);
    setError(null);
    setDevOtpBanner(null);
    setPendingUid("");
    setPendingEmail("");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left branding pane - visible on desktop */}
      <div className="hidden w-1/2 flex-col justify-between bg-emerald-900 p-12 text-white lg:flex relative overflow-hidden">
        {/* Decorative background circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-800 opacity-40"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-emerald-800 opacity-40"></div>

        <div className="flex items-center space-x-3 z-10">
          <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md overflow-hidden">
            <img
              src="/dar_logo.png"
              alt="DAR Logo"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="text-center">
                      <p class="text-[10px] leading-3 font-extrabold text-emerald-800">DAR</p>
                      <p class="text-[8px] leading-3 font-semibold text-amber-500">PH</p>
                    </div>
                  `;
                }
              }}
            />
          </div>
          <div>
            <span className="text-lg font-bold tracking-wider text-white">
              ARBO Support
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

      {/* Right Content pane */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-24 bg-slate-50">
        <div className="mx-auto w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          
          {/* STEP 1: CREDENTIALS FORM */}
          {step === "credentials" && (
            <>
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

              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
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
            </>
          )}

          {/* STEP 2: 2FA OTP CHALLENGE FORM */}
          {step === "otp" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-sm">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Two-Factor Security
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  We've sent a 6-digit authentication code to:
                </p>
                <div className="mt-1 inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {maskEmail(pendingEmail)}
                </div>
              </div>

              {/* Dev Mode Simulation Banner */}
              {devOtpBanner && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start space-x-2">
                  <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold">Development Mode:</span> EmailJS keys are not yet configured in <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code>.
                    <p className="mt-1">
                      Your test OTP code is: <span className="font-mono font-extrabold text-sm text-emerald-800 tracking-widest">{devOtpBanner}</span>
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start space-x-2.5 rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs font-medium text-red-600">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Enter 6-Digit Passcode
                  </label>
                  <div className="flex justify-between gap-2">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className="h-12 w-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-xl font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        required
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    Expires in:{" "}
                    <span className={`font-semibold ${expirySeconds < 60 ? "text-red-600 font-bold" : "text-slate-700"}`}>
                      {formatTime(expirySeconds)}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    <RotateCw size={12} className={resendCooldown > 0 ? "animate-spin" : ""} />
                    <span>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otpDigits.join("").length !== 6 || expirySeconds === 0}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3.5 px-4 text-sm font-semibold text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/10 cursor-pointer"
                >
                  {otpLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify &amp; Access Account</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={handleCancelOtp}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Use a different account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

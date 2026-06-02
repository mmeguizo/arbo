import React, { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { initializeApp, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db, firebaseConfig } from "../firebase/config";
import {
  UserPlus,
  Users,
  Shield,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Hash,
  Eye,
  EyeOff,
  PowerOff,
  Power,
  KeyRound,
  Globe,
} from "lucide-react";

import localityData from "../data/locality.json";

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "arb" | "staff" | "surveyor" | "admin";
  barangay: string;
  municipality: string;
  province: string;
  createdAt: string;
  isActive?: boolean;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"staff" | "surveyor" | "admin">("staff");
  const [province, setProvince] = useState("Negros Occidental");
  const [barangay, setBarangay] = useState("Isabela");
  const [municipality, setMunicipality] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const fetchUsers = async () => {
    try {
      // Query to get Admin, Staff, & Surveyor accounts
      const snap = await getDocs(collection(db, "users"));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const u = d.data();
        if (u.role && u.role !== "arb") {
          list.push({
            uid: d.id,
            name: u.name || "Unnamed",
            email: u.email || "",
            role: u.role as "staff" | "surveyor" | "admin",
            barangay: u.barangay || "",
            municipality: u.municipality || "",
            province: u.province || "Negros Occidental",
            createdAt: u.createdAt || "",
            isActive: u.isActive !== false, // default true
          });
        }
      });
      setUsers(list);
    } catch (err) {
      console.error("Failed to load official profile list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        fetchUsers();
      }
    }, 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setFeedback({ type: "error", msg: "Please fill out all user fields." });
      return;
    }

    if (password.length < 6) {
      setFeedback({
        type: "error",
        msg: "Password must be at least 6 characters long.",
      });
      return;
    }

    setSubmitting(true);
    let secondaryAppInstance: FirebaseApp | null = null;

    try {
      // SENIOR DEVELOPER PATTERN: Using a temporary secondary app instance of Firebase
      // lets the Admin create new Auth credentials securely in the background without
      // logging themselves out of the primary session.
      const appName = `temp-user-creator-${Date.now()}`;
      secondaryAppInstance = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryAppInstance);

      // Create authentication profile
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email.trim(),
        password,
      );
      const newUserUid = userCredential.user.uid;

      // Write profile to primary Firestore database
      const profilePayload = {
        uid: newUserUid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role,
        province: province,
        municipality: municipality,
        barangay: barangay,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", newUserUid), profilePayload);

      // Success feedback
      setFeedback({
        type: "success",
        msg: `Successfully spawned official account: ${name.trim()} as ${role.toUpperCase()}!`,
      });

      // Clear Form Fields
      setName("");
      setEmail("");
      setPassword("");

      // Reload directory list
      await fetchUsers();
    } catch (err: unknown) {
      console.error("Firebase secondary app deployment error:", err);
      let errorText = "An error occurred while seeding credentials.";
      const errorWithCode = err as { code?: string };
      if (errorWithCode.code === "auth/email-already-in-use") {
        errorText =
          "This email is already in use by another official or beneficiary.";
      } else if (errorWithCode.code === "auth/invalid-email") {
        errorText = "The email address is formatted incorrectly.";
      }
      setFeedback({ type: "error", msg: errorText });
    } finally {
      // Disconnect and clean up secondary instance to free memory
      if (secondaryAppInstance) {
        try {
          await deleteApp(secondaryAppInstance);
        } catch (delErr) {
          console.error("Failed to delete secondary instance:", delErr);
        }
      }
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userProfile: UserProfile) => {
    try {
      const newStatus = !userProfile.isActive;
      await updateDoc(doc(db, "users", userProfile.uid), {
        isActive: newStatus,
      });
      setFeedback({
        type: "success",
        msg: `User ${userProfile.name} is now ${newStatus ? "Active" : "Disabled"}.`,
      });
      await fetchUsers();
    } catch (err) {
      console.error("Failed to toggle status", err);
      setFeedback({ type: "error", msg: "Failed to update user status." });
    }
  };

  const handleResetPassword = async (emailToReset: string) => {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, emailToReset);
      setFeedback({
        type: "success",
        msg: `Password reset email sent to ${emailToReset}`,
      });
    } catch (err) {
      console.error("Failed to send reset email", err);
      setFeedback({ type: "error", msg: "Failed to send password reset email." });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR Admin Management
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Officer & Staff Configuration
            </h1>
          </div>
        </header>

        {/* Dynamic scroll view splits */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT: SPAWN CREATION FORM */}
          <div className="w-full md:w-96 border-r border-slate-200 bg-white p-6 overflow-y-auto text-left">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <UserPlus size={16} className="text-themeGreen" />
              <span>Register Official / Examiner</span>
            </h3>
            <p className="text-[10px] text-slate-400 mb-5 leading-normal">
              Directly seed authentic DAR Staff, Surveyor, or sub-admin
              profiles. These bypass the farmer registration flow and acquire
              instantaneous role-restricted privileges.
            </p>

            {feedback && (
              <div
                className={`mb-5 p-4 rounded-xl border text-xs leading-normal flex items-start space-x-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                    : "bg-red-50 border-red-250 text-red-700"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                )}
                <span className="font-semibold">{feedback.msg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Code Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enrique Gil"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Agency Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enrique.dar@gov.ph"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Temporary Access Phrase
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-emerald-800 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Assigned Administrative Role
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "staff" | "surveyor" | "admin")
                  }
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                >
                  <option value="staff">
                    DAR Staff (Municipal Document Screener)
                  </option>
                  <option value="surveyor">
                    DAR Surveyor (GPS/Title Coordinator)
                  </option>
                  <option value="admin">
                    District Administrator (Final Approver)
                  </option>
                </select>
              </div>

              {/* Province */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Province
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Globe size={14} />
                  </div>
                  <select
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold appearance-none"
                  >
                    {localityData.provinces.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Municipality */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Municipality / City
                </label>
                <input
                  type="text"
                  required
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  placeholder="Kabankalan City"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                />
              </div>

              {/* Office */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Office / District
                </label>
                <input
                  type="text"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  placeholder="Isabela Branch Office"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <UserPlus size={14} className="stroke-[2.5]" />
                      <span>Configure Official Identity</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: REGISTERED ROSTER DIRECTORY */}
          <div className="flex-1 bg-slate-50 p-6 overflow-y-auto text-left">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Users size={16} className="text-indigo-700" />
              <span>Official Account Directory</span>
            </h3>
            <p className="text-[10px] text-slate-400 mb-5 leading-normal">
              Roster of active personnel configured for municipal validation and
              land parcel surveying across Negros provinces.
            </p>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-850 border-t-transparent"></div>
                  <span className="text-[11px] font-bold">
                    Scanning personnel active registry...
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                      <tr>
                        <th scope="col" className="px-5 py-3">
                          Official User
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Province
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Municipality
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Role Status
                        </th>
                        <th scope="col" className="px-5 py-3">
                          Created
                        </th>
                        <th scope="col" className="px-5 py-3 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-2.5">
                              <span className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-800 font-extrabold flex items-center justify-center border border-emerald-100 uppercase text-[10px]">
                                {u.name.substring(0, 2)}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900 m-0">
                                  {u.name}
                                </p>
                                <p className="text-[9px] text-slate-400 m-0">
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-slate-600 font-bold">
                            {u.province}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-slate-600 font-bold">
                            {u.municipality || u.barangay}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                                u.role === "admin"
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : u.role === "surveyor"
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                              }`}
                            >
                              {u.role === "admin" && <Shield size={10} />}
                              {u.role === "surveyor" && <Hash size={10} />}
                              {u.role === "staff" && <Briefcase size={10} />}
                              <span>{u.role}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-slate-400 text-[10px]">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString()
                              : "--"}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-right space-x-2">
                            <button
                              onClick={() => handleResetPassword(u.email)}
                              title="Send Password Reset Email"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                            >
                              <KeyRound size={12} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.isActive ? "Disable User" : "Enable User"}
                              className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${
                                u.isActive
                                  ? "bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700"
                                  : "bg-emerald-50 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
                              }`}
                            >
                              {u.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                            </button>
                          </td>
                        </tr>
                      ))}

                        {users.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-8 text-center text-slate-405 italic"
                          >
                            No secondary official accounts registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

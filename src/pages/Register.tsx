import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { useAuth } from "../contexts/AuthContext";
import { broadcastNotification } from "../contexts/NotificationContext";
import { auth, db } from "../firebase/config";
import { uploadFile, getDocumentPath } from "../utils/storage";
import {
  ArrowLeft,
  User,
  MapPin,
  Upload,
  Lock,
  Mail,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
} from "lucide-react";

import localityData from "../data/locality.json";

type DocumentField = "cedula" | "birthCert" | "brgyCert" | "picture";

interface UploadedDocumentUrls {
  cedula: string | null;
  birthCert: string | null;
  brgyCert: string | null;
  picture: string | null;
}

interface PsgcLocationItem {
  code: string;
  name: string;
}

interface PsgcListResponse<T> {
  data: T[];
}

const getPsgcItems = (
  payload: PsgcLocationItem[] | PsgcListResponse<PsgcLocationItem>,
) => {
  const items = Array.isArray(payload) ? payload : payload.data;

  return items.map((item) => ({
    code: item.code,
    name: item.name.trim(),
  }));
};

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");

  // Location cascade (supports both Negros provinces)
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [barangay, setBarangay] = useState("");
  const [municipalities, setMunicipalities] = useState<PsgcLocationItem[]>([]);
  const [barangays, setBarangays] = useState<PsgcLocationItem[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);

  // Document files selected for upload (stored as File objects, uploaded to Storage on submit)
  const [docFiles, setDocFiles] = useState<{
    cedula: File | null;
    birthCert: File | null;
    brgyCert: File | null;
    picture: File | null;
  }>({
    cedula: null,
    birthCert: null,
    brgyCert: null,
    picture: null,
  });

  const [docNames, setDocNames] = useState<{
    cedula: string;
    birthCert: string;
    brgyCert: string;
    picture: string;
  }>({
    cedula: "",
    birthCert: "",
    brgyCert: "",
    picture: "",
  });

  const provinceOptions = localityData.provinces.map((p) => p.name);

  // Load municipalities when province changes
  React.useEffect(() => {
    setMunicipality("");
    setMunicipalityCode("");
    setBarangays([]);
    setBarangay("");

    if (!province) {
      setMunicipalities([]);
      return;
    }

    const selected = localityData.provinces.find((p) => p.name === province);
    if (selected) {
      setMunicipalities(
        selected.municipalities
          .map((m) => ({ code: m.code, name: m.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }, [province]);

  // Load barangays whenever municipality selection changes
  React.useEffect(() => {
    if (!municipalityCode) {
      setBarangays([]);
      setBarangay("");
      return;
    }
    const loadBarangays = async () => {
      setLocationLoading(true);
      try {
        const res = await fetch(
          `https://psgc.gitlab.io/api/cities-municipalities/${encodeURIComponent(municipalityCode)}/barangays/`,
        );
        if (!res.ok) {
          throw new Error(`Barangays request failed: ${res.status}`);
        }
        const payload: PsgcLocationItem[] | PsgcListResponse<PsgcLocationItem> =
          await res.json();
        const items = getPsgcItems(payload);
        setBarangays([...items].sort((a, b) => a.name.localeCompare(b.name)));
        setBarangay("");
      } catch (e) {
        console.error("PSGC API failed, falling back to local data:", e);
        // Fallback: use barangays from locality.json
        const fallback = (() => {
          for (const p of localityData.provinces) {
            const mun = p.municipalities.find(
              (m) => m.code === municipalityCode,
            );
            if (mun && "barangays" in mun) {
              return (
                mun as {
                  code: string;
                  name: string;
                  barangays: PsgcLocationItem[];
                }
              ).barangays;
            }
          }
          return null;
        })();
        if (fallback && fallback.length > 0) {
          setBarangays(
            [...fallback].sort((a, b) => a.name.localeCompare(b.name)),
          );
        } else {
          setBarangays([]);
        }
        setBarangay("");
      } finally {
        setLocationLoading(false);
      }
    };
    loadBarangays();
  }, [municipalityCode]);

  // Handle local file select — stores File object for later upload to Firebase Storage
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: DocumentField,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError(
          `${file.name} is larger than 10MB. Please choose a smaller file.`,
        );
        e.target.value = "";
        return;
      }
      setError(null);
      setDocNames((prev) => ({ ...prev, [type]: file.name }));
      setDocFiles((prev) => ({ ...prev, [type]: file }));
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (
        !name ||
        !age ||
        !contact ||
        !address ||
        !province ||
        !municipality ||
        !barangay
      ) {
        setError("All personal details including province are required.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Documents are optional — can be uploaded later from the account
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  const [submitted, setSubmitted] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted) return; // Prevent double submission
    setError(null);
    setLoading(true);
    setSubmitted(true);

    if (!email || !password) {
      setError("Email and Password are required.");
      setLoading(false);
      setSubmitted(false);
      return;
    }

    let createdUser:
      | Awaited<ReturnType<typeof createUserWithEmailAndPassword>>["user"]
      | null = null;

    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const authUser = userCredential.user;
      createdUser = authUser;

      const appRefId = `APP-${Math.floor(100000 + Math.random() * 900000)}`;

      // 2. Upload documents to Firebase Storage and collect download URLs
      const uploadedDocuments: UploadedDocumentUrls = {
        cedula: null,
        birthCert: null,
        brgyCert: null,
        picture: null,
      };

      const docTypes: DocumentField[] = [
        "cedula",
        "birthCert",
        "brgyCert",
        "picture",
      ];
      for (const docType of docTypes) {
        const file = docFiles[docType];
        if (file) {
          try {
            const path = getDocumentPath(authUser.uid, docType, file);
            const url = await uploadFile(file, path);
            uploadedDocuments[docType] = url;
          } catch (uploadErr) {
            console.error(`Failed to upload ${docType}:`, uploadErr);
            // Non-fatal — doc will just be null
          }
        }
      }

      // Save user record
      await setDoc(doc(db, "users", authUser.uid), {
        uid: authUser.uid,
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        age: Number(age),
        contact: contact.trim(),
        municipality: municipality.trim(),
        barangay: barangay.trim(),
        province: province.trim(),
        role: "arb",
        createdAt: new Date().toISOString(),
      });

      // Save application document
      await setDoc(doc(db, "applications", appRefId), {
        applicationId: appRefId,
        userId: authUser.uid,
        userName: name.trim(),
        userEmail: email.trim(),
        userMunicipality: municipality.trim(),
        userBarangay: barangay.trim(),
        userProvince: province.trim(),
        status: "under_review",
        submittedAt: new Date().toISOString(),
        reviewedByStaff: null,
        staffReviewedAt: null,
        approvedByAdmin: null,
        adminApprovedAt: null,
        notes: "",
        documents: uploadedDocuments,
      });

      // Notify all staff members of the new application
      await broadcastNotification(
        "staff",
        "submitted",
        "New ARB Application Submitted",
        `${name.trim()} from ${barangay.trim()}, ${municipality.trim()} has submitted a new application (${appRefId}) for review.`,
        appRefId,
      );

      await refreshProfile();

      // Successfully registered! Go to ARB landing page
      navigate("/my-application");
    } catch (err: unknown) {
      console.error("Registration error:", err);
      const firebaseError = err as { code?: string; message?: string };

      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error(
            "Failed to rollback partially created auth user:",
            cleanupError,
          );
        }
      }

      if (firebaseError.code === "auth/email-already-in-use") {
        setError("This email address is already in use.");
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Password is too weak. Please use at least 6 characters.");
      } else {
        setError(
          firebaseError.message ||
            "Failed to complete registration. Please try again.",
        );
      }
    } finally {
      setLoading(false);
      setSubmitted(false);
    }
  };

  // Helper to check if a document file is selected
  const hasDoc = (type: DocumentField) => docFiles[type] !== null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Top header navigation */}
        <div className="bg-emerald-900 px-8 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="text-white hover:text-amber-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200 m-0">
                ARB Registration
              </p>
              <h2 className="text-lg font-bold text-white m-0">
                Create Beneficiary Account
              </h2>
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-300">
            Step {step} of 3
          </div>
        </div>

        {/* Step Progress Dots indicator */}
        <div className="flex justify-center space-x-12 py-5 bg-slate-50 border-b border-slate-100">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center space-x-2">
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-extrabold border ${
                  step === s
                    ? "bg-emerald-800 text-white border-emerald-800"
                    : step > s
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {step > s ? <Check size={12} className="stroke-3" /> : s}
              </span>
              <span
                className={`text-xs font-bold ${step === s ? "text-emerald-900" : "text-slate-400"}`}
              >
                {s === 1
                  ? "Personal Details"
                  : s === 2
                    ? "Upload Documents"
                    : "Credentials"}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-8 mt-6 flex items-start space-x-2.5 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-500">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="p-8">
          {/* STEP 1: PERSONAL DETAILS */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Full Name (as in Official IDs)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Age
                  </label>
                  <input
                    type="number"
                    required
                    min={18}
                    value={age}
                    onChange={(e) =>
                      setAge(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="35"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="09171234567"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Province
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Globe size={18} />
                    </div>
                    <select
                      required
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium appearance-none"
                    >
                      <option value="">Select province</option>
                      {provinceOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    City / Municipality
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin size={18} />
                    </div>
                    <select
                      required
                      value={municipalityCode}
                      onChange={(e) => {
                        const selected = municipalities.find(
                          (m) => m.code === e.target.value,
                        );
                        setMunicipalityCode(e.target.value);
                        setMunicipality(selected?.name ?? "");
                      }}
                      disabled={!province || locationLoading}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium appearance-none disabled:opacity-50"
                    >
                      <option value="">
                        {!province
                          ? "Select province first"
                          : "Select municipality"}
                      </option>
                      {municipalities.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Barangay
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin size={18} />
                    </div>
                    <select
                      required
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      disabled={!municipalityCode || locationLoading}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium appearance-none disabled:opacity-50"
                    >
                      <option value="">
                        {!municipalityCode
                          ? "Select municipality first"
                          : locationLoading
                            ? "Loading barangays..."
                            : "Select barangay"}
                      </option>
                      {barangays.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Complete Address
                  </label>
                  <textarea
                    required
                    rows={1}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street name, Purok / Sitio, etc."
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-6 text-sm font-semibold text-white transition-all shadow-lg cursor-pointer"
                >
                  <span>Upload Documents</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD DOCUMENTS */}
          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm font-medium text-slate-600 border-l-4 border-amber-500 pl-3 bg-amber-50 py-3 rounded-r-xl">
                Please attach digital references of your official credentials.
                Supported formats: JPG, PNG, PDF. Max size 5MB.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cedula */}
                <div className="border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-5 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center">
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    Community Tax Certificate (Cedula)
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {docNames.cedula || "No file chosen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange(e, "cedula")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {hasDoc("cedula") && (
                    <span className="absolute top-2 right-2 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </div>

                {/* Birth Certificate */}
                <div className="border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-5 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center">
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    Birth Certificate
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {docNames.birthCert || "No file chosen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange(e, "birthCert")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {hasDoc("birthCert") && (
                    <span className="absolute top-2 right-2 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </div>

                {/* Barangay Certificate */}
                <div className="border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-5 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center">
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    Barangay Certificate (Residency check)
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {docNames.brgyCert || "No file chosen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange(e, "brgyCert")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {hasDoc("brgyCert") && (
                    <span className="absolute top-2 right-2 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </div>

                {/* Profile Picture */}
                <div className="border border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 p-5 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center">
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-800">
                    Beneficiary Profile Picture
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {docNames.picture || "No file chosen"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "picture")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {hasDoc("picture") && (
                    <span className="absolute top-2 right-2 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center space-x-2 rounded-xl border border-slate-200 hover:bg-slate-100 py-3 px-6 text-sm font-semibold text-slate-700 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Personal Details</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-xl border border-slate-300 hover:bg-slate-100 py-3 px-5 text-sm font-semibold text-slate-500 transition-all cursor-pointer"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-6 text-sm font-semibold text-white transition-all shadow-lg cursor-pointer"
                  >
                    <span>Setup Credentials</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CREDENTIALS */}
          {step === 3 && (
            <div className="space-y-5">
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
                    placeholder="beneficiary@domain.com"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Set Secure Password
                </label>
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
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-emerald-800 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex items-center space-x-2 rounded-xl border border-slate-200 hover:bg-slate-100 py-3 px-6 text-sm font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  <span>Attach Documents</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3 px-8 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-900/10 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <Check size={16} className="stroke-3" />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

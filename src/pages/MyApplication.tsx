import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import {
  collection,
  query,
  getDocs,
  where,
  limit,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  FileText,
  Map,
  CreditCard,
  Layers,
  MapPin,
  Calendar,
  AlertCircle,
  Hash,
  Upload,
  Trash2,
  Eye,
  X,
  RotateCcw,
} from "lucide-react";

type DocField = "cedula" | "birthCert" | "brgyCert";

interface LandTitle {
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  geoLat: string;
  geoLng: string;
  encodedAt: string;
}

interface ApplicationData {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string;
  documents: {
    cedula: string | null;
    birthCert: string | null;
    brgyCert: string | null;
    picture: string | null;
  };
  notes: string;
}

export const MyApplication: React.FC = () => {
  const { profile, user } = useAuth();
  const [app, setApp] = useState<ApplicationData | null>(null);
  const [title, setTitle] = useState<LandTitle | null>(null);
  const [loading, setLoading] = useState(true);

  // Document management state
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    src: string;
  } | null>(null);
  const [updatingDoc, setUpdatingDoc] = useState<DocField | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocField | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Only allow edits before final approval
  const canModify = app && app.status !== "verified" && app.status !== "awarded";

  // After modifying a doc, push back to under_review so staff re-evaluates
  const revertedStatus = (): ApplicationStatus => "under_review";

  const handleReplaceDocument = (
    type: DocField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;
    if (file.size > 5 * 1024 * 1024) {
      setDocError(`File is too large (max 5MB). Please choose a smaller file.`);
      e.target.value = "";
      return;
    }
    setDocError(null);
    setUpdatingDoc(type);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const newStatus = revertedStatus();
        const appRef = doc(db, "applications", app.applicationId);
        await updateDoc(appRef, {
          [`documents.${type}`]: base64,
          status: newStatus,
        });
        setApp((prev) =>
          prev
            ? {
                ...prev,
                documents: { ...prev.documents, [type]: base64 },
                status: newStatus,
              }
            : prev,
        );
      } catch (err) {
        console.error("Failed to replace document:", err);
        setDocError("Failed to update document. Please try again.");
      } finally {
        setUpdatingDoc(null);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = async (type: DocField) => {
    if (!app) return;
    setConfirmDelete(null);
    setUpdatingDoc(type);
    try {
      const newStatus = revertedStatus();
      const appRef = doc(db, "applications", app.applicationId);
      await updateDoc(appRef, {
        [`documents.${type}`]: null,
        status: newStatus,
      });
      setApp((prev) =>
        prev
          ? {
              ...prev,
              documents: { ...prev.documents, [type]: null },
              status: newStatus,
            }
          : prev,
      );
    } catch (err) {
      console.error("Failed to delete document:", err);
      setDocError("Failed to remove document. Please try again.");
    } finally {
      setUpdatingDoc(null);
    }
  };

  useEffect(() => {
    const fetchApplicationInfo = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Fetch user's application
        const q = query(
          collection(db, "applications"),
          where("userId", "==", user.uid),
          limit(1),
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const appDoc = qSnap.docs[0];
          const appData = appDoc.data() as ApplicationData;
          setApp({ ...appData, applicationId: appDoc.id });

          // 2. Fetch associated land title details if app is verified
          const tQ = query(
            collection(db, "landTitles"),
            where("beneficiaryId", "==", user.uid),
            limit(1),
          );
          const tSnap = await getDocs(tQ);
          if (!tSnap.empty) {
            setTitle(tSnap.docs[0].data() as LandTitle);
          }
        }
      } catch (err) {
        console.error("Error fetching applicant info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationInfo();
  }, [user]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left animate-fade-in">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              ARB Area workspace
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              My CLOA & Title Record
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500">
                Loading your agrarian file...
              </p>
            </div>
          </div>
        ) : (
          <main className="flex-1 p-8 space-y-8 max-w-5xl">
            {/* Top overview widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile card summary */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left lg:col-span-2 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      Resident Beneficiary
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">
                      {profile?.name}
                    </h2>
                    <p className="text-xs text-slate-550 mt-1">
                      {profile?.address}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-emerald-800/10 border border-emerald-100 flex items-center justify-center overflow-hidden">
                    {app?.documents.picture ? (
                      <img
                        src={app.documents.picture}
                        alt="Profile photo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-emerald-800 font-bold uppercase">
                        {profile?.name.substring(0, 2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Age
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.age} years old
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Contact
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.contact}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Barangay
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.barangay}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Registry Date
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString()
                        : "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Application details card status */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Application File Status
                  </span>
                  {app ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          ID: {app.applicationId}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed pt-2">
                        {app.status === "under_review" &&
                          "Your application credentials have been successfully uploaded. DAR municipal evaluators are manually checking your files."}
                        {app.status === "pending" &&
                          "Municipal staff has verified your files! Waiting on Admin/Regional Director final confirmation."}
                        {app.status === "verified" &&
                          "Your application has been fully approved by the Admin/Regional Director. The surveyor team will now encode your land title boundaries."}
                        {app.status === "awarded" &&
                          "Congratulations! Your CLOA title has been officially awarded. The surveyor has encoded your land parcel details — check below for your title card."}
                        {app.status === "disputed" &&
                          "There is an issue with your credentials/residency. Please reach out to your municipal officer immediately."}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic text-xs">
                      No application record generated yet. Please contact the
                      administrator.
                    </div>
                  )}
                </div>

                {app?.notes && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-left text-xs text-slate-600">
                    <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">
                      Evaluator Comments
                    </span>
                    <span>"{app.notes}"</span>
                  </div>
                )}
              </div>
            </div>

            {/* Awarded land title details widget (Renders ONLY if surveyor has encoded title) */}
            {title ? (
              <div className="bg-white rounded-2xl border border-emerald-250 shadow-sm p-6 text-left border-l-8 border-l-emerald-800 space-y-6">
                <div>
                  <span className="text-[10px] uppercase bg-emerald-50 text-emerald-800 border-emerald-200 border px-2.5 py-1 rounded inline-block font-extrabold">
                    Certificate of Land Ownership Award (CLOA)
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
                    Awarded Agrarian Land Parcel
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    This is your official title details encoded and verified by
                    the DAR Municipal Surveyor.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 text-sm">
                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Hash size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Title Number (OCT/TCT)
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.titleNumber}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Layers size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Lot / Parcel Number
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.lotNumber}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Map size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Land Area
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.areaHectares} Hectares
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <MapPin size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Municipality
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.municipality}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></div>
                    <span className="font-semibold text-emerald-900">
                      Geographic Coordinates verified by Surveyor:
                    </span>
                    <span className="font-mono text-slate-700 bg-white border px-2 py-0.5 rounded font-bold">
                      Lat: {title.geoLat}, Lng: {title.geoLng}
                    </span>
                  </div>
                  <span className="text-slate-450 italic flex items-center space-x-1">
                    <Calendar size={12} />
                    <span>
                      Awarded on:{" "}
                      {new Date(title.encodedAt).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              </div>
            ) : (app?.status === "verified" || app?.status === "awarded") ? (
              <div className="bg-amber-50 rounded-2xl border border-amber-250 p-6 text-left flex items-start space-x-3.5">
                <AlertCircle
                  size={22}
                  className="text-amber-700 shrink-0 mt-0.5 animate-bounce"
                />
                <div className="space-y-1">
                  <h3 className="font-bold text-amber-900 text-sm">
                    Waiting for Surveyor Encoding
                  </h3>
                  <p className="text-xs text-amber-750 leading-relaxed">
                    Great news! Your agrarian documents have been approved by
                    the Admin/Director. We are currently dispatching our
                    municipal surveyor to encode your precise geographic lot
                    limits and award your TCT title card in the digital system.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Document management section */}
            {app && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Application Documents
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Documents submitted during registration. You may replace
                      or remove a file — doing so will reset your status back to{" "}
                      <span className="font-bold text-emerald-700">
                        Under Review
                      </span>{" "}
                      for staff to re-evaluate.
                    </p>
                  </div>
                  {app.status === "verified" && (
                    <span className="shrink-0 text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg font-bold ml-4">
                      Approved — read-only
                    </span>
                  )}
                </div>

                {docError && (
                  <div className="mt-3 flex items-center space-x-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{docError}</span>
                  </div>
                )}

                {/* Document cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
                  {(
                    [
                      {
                        type: "cedula" as DocField,
                        label: "CTC (Cedula)",
                        sub: "Identity / Tax reference",
                        icon: (
                          <CreditCard size={18} className="text-slate-500" />
                        ),
                        src: app.documents.cedula,
                      },
                      {
                        type: "birthCert" as DocField,
                        label: "Birth Certificate",
                        sub: "Kinship & residency proof",
                        icon: <FileText size={18} className="text-slate-500" />,
                        src: app.documents.birthCert,
                      },
                      {
                        type: "brgyCert" as DocField,
                        label: "Barangay Residency Cert",
                        sub: "10-year municipal proof",
                        icon: <MapPin size={18} className="text-slate-500" />,
                        src: app.documents.brgyCert,
                      },
                    ] as {
                      type: DocField;
                      label: string;
                      sub: string;
                      icon: React.ReactNode;
                      src: string | null;
                    }[]
                  ).map(({ type, label, sub, icon, src }) => {
                    const isUpdating = updatingDoc === type;
                    return (
                      <div
                        key={type}
                        className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col items-center text-center space-y-3"
                      >
                        {icon}
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {sub}
                          </span>
                        </div>

                        {/* Thumbnail or missing badge */}
                        {src ? (
                          <button
                            onClick={() => setPreviewDoc({ title: label, src })}
                            className="relative group h-24 w-full bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner cursor-pointer"
                          >
                            {src.startsWith("data:application/pdf") ? (
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                PDF Document
                              </span>
                            ) : (
                              <img
                                src={src}
                                alt={`${label} preview`}
                                className="h-full w-full object-contain"
                              />
                            )}
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye size={18} className="text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                            Not uploaded
                          </span>
                        )}

                        {/* Action buttons — hidden once verified */}
                        {canModify && (
                          <div className="flex items-center justify-center gap-2 w-full pt-1">
                            {/* Replace */}
                            <label
                              className={`flex items-center space-x-1 text-[10px] font-bold cursor-pointer px-2.5 py-1.5 rounded-lg border transition-colors ${
                                isUpdating
                                  ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                                  : "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                              }`}
                            >
                              {isUpdating ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                              ) : (
                                <Upload size={11} />
                              )}
                              <span>{src ? "Replace" : "Upload"}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="sr-only"
                                disabled={isUpdating}
                                onChange={(e) => handleReplaceDocument(type, e)}
                              />
                            </label>

                            {/* Delete — only if document exists */}
                            {src && (
                              <button
                                disabled={isUpdating}
                                onClick={() => setConfirmDelete(type)}
                                className={`flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                                  isUpdating
                                    ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
                                    : "bg-white border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                }`}
                              >
                                <Trash2 size={11} />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status revert notice when a doc is being managed */}
            {canModify && app?.status !== "under_review" && (
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 text-left flex items-start space-x-3">
                <RotateCcw
                  size={16}
                  className="text-amber-700 shrink-0 mt-0.5"
                />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">Note:</span> Replacing or removing
                  any document will automatically reset your application status
                  to <span className="font-bold">Under Review</span>, requiring
                  staff to re-evaluate your file.
                </p>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Full-screen document preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">
                {previewDoc.title}
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-6 min-h-80">
              {previewDoc.src.startsWith("data:application/pdf") ? (
                <iframe
                  src={previewDoc.src}
                  title={previewDoc.title}
                  className="w-full h-[70vh] rounded-lg"
                />
              ) : (
                <img
                  src={previewDoc.src}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-left space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Remove Document?
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will delete the document and reset your application
                  status back to{" "}
                  <span className="font-bold text-emerald-700">
                    Under Review
                  </span>
                  . Staff will need to re-evaluate your file.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDocument(confirmDelete)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

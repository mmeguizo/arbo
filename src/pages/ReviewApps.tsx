import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import {
  collection,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  FileText,
  User,
  Check,
  XCircle,
  ArrowRight,
  Eye,
  CheckCircle2,
} from "lucide-react";

interface Application {
  id: string;
  userId: string;
  userName: string;
  userBarangay: string;
  userMunicipality: string;
  userProvince: string;
  status: ApplicationStatus;
  submittedAt: string;
  notes: string;
  documents: {
    cedula: string | null;
    birthCert: string | null;
    brgyCert: string | null;
    picture: string | null;
  };
}

export const ReviewApps: React.FC = () => {
  const { profile } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesInput, setNotesInput] = useState("");

  // Admin defaults to "pending" (Admin Stage) so they see apps awaiting their approval
  const [activeTab, setActiveTab] = useState<
    "under_review" | "pending" | "resolved"
  >(profile?.role === "admin" ? "pending" : "under_review");

  // Modal for previewing documents
  const [activePreviewDoc, setActivePreviewDoc] = useState<{
    title: string;
    src: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "applications"),
      orderBy("submittedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Application[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Application);
        });
        setApps(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error with snapshot listener:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Update selection if active tab changes or if apps change via snapshot
  useEffect(() => {
    if (selectedApp) {
      // Keep current selection updated with live changes
      const updated = apps.find((a) => a.id === selectedApp.id);
      if (updated) {
        // Only update if status changed or notes changed to avoid re-renders
        if (updated.status !== selectedApp.status) {
          setSelectedApp(updated);
        }
      }
      return;
    }

    const defaultSelect = apps.find((a) => {
      if (activeTab === "under_review") return a.status === "under_review";
      if (activeTab === "pending") return a.status === "pending";
      return a.status === "verified" || a.status === "awarded" || a.status === "disputed";
    });
    
    if (defaultSelect) {
      setSelectedApp(defaultSelect);
      setNotesInput(defaultSelect.notes || "");
    } else {
      setSelectedApp(null);
    }
  }, [activeTab, apps, selectedApp]);

  const handleSelectApp = (appItem: Application) => {
    setSelectedApp(appItem);
    setNotesInput(appItem.notes || "");
  };

  // Status transitions
  const updateStatus = async (newStatus: ApplicationStatus) => {
    if (!selectedApp) return;

    try {
      setLoading(true);
      const docRef = doc(db, "applications", selectedApp.id);

      const payload: any = {
        status: newStatus,
        notes: notesInput.trim(),
      };

      if (profile?.role === "staff") {
        payload.reviewedByStaff = profile.name;
        payload.staffReviewedAt = new Date().toISOString();
      } else if (profile?.role === "admin") {
        payload.approvedByAdmin = profile.name;
        payload.adminApprovedAt = new Date().toISOString();
      }

      await updateDoc(docRef, payload);

      // Snapshot will automatically update the UI list
    } catch (err) {
      console.error("Failed to commit status change:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter apps list based on active tab
  const getFilteredApps = () => {
    return apps.filter((a) => {
      if (activeTab === "under_review") return a.status === "under_review";
      if (activeTab === "pending") return a.status === "pending";
      return a.status === "verified" || a.status === "awarded" || a.status === "disputed";
    });
  };

  const filteredList = getFilteredApps();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR Evaluator Dashboard
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              CLOA Document Processing
            </h1>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-100">
            Evaluating role:{" "}
            <span className="uppercase text-amber-600 font-extrabold">
              {profile?.role}
            </span>
          </span>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL: APPLICATIONS LIST */}
          <div className="w-80 border-r border-slate-200 bg-white flex flex-col justify-start">
            {/* Stage tab selectors */}
            <div className="grid grid-cols-3 border-b border-slate-100 text-xs font-bold text-center shrink-0">
              <button
                onClick={() => setActiveTab("under_review")}
                className={`py-3.5 border-b-2 hover:bg-slate-50 transition-colors ${
                  activeTab === "under_review"
                    ? "border-emerald-800 text-emerald-800 bg-emerald-50/10 font-bold"
                    : "border-transparent text-slate-400 font-medium"
                }`}
              >
                Staff Stage
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`py-3.5 border-b-2 hover:bg-slate-50 transition-colors ${
                  activeTab === "pending"
                    ? "border-amber-600 text-amber-700 bg-amber-50/10 font-bold"
                    : "border-transparent text-slate-400 font-medium"
                }`}
              >
                Admin Stage
              </button>
              <button
                onClick={() => setActiveTab("resolved")}
                className={`py-3.5 border-b-2 hover:bg-slate-50 transition-colors ${
                  activeTab === "resolved"
                    ? "border-blue-600 text-blue-800 bg-blue-50/10 font-bold"
                    : "border-transparent text-slate-400 font-medium"
                }`}
              >
                Resolved
              </button>
            </div>

            {/* List entries */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent mx-auto mb-2"></div>
                  Loading directory...
                </div>
              ) : filteredList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No applications currently at this stage.
                </div>
              ) : (
                filteredList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectApp(item)}
                    className={`p-4 text-left cursor-pointer transition-colors border-l-4 ${
                      selectedApp?.id === item.id
                        ? "bg-emerald-50/40 border-l-emerald-800"
                        : "hover:bg-slate-50 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-slate-900 truncate max-w-30">
                        {item.userName}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-[10px] text-slate-400">ID: {item.id}</p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      Brgy: {item.userBarangay}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANEL: SELECTED APPLICATION DETAIL PANEL */}
          <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
            {selectedApp ? (
              <div className="space-y-6 max-w-4xl text-left">
                {/* Applicant Summary */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <h2 className="text-lg font-bold text-slate-900 m-0">
                        {selectedApp.userName}
                      </h2>
                      <StatusBadge status={selectedApp.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      Application Reference Number:{" "}
                      <span className="font-mono font-bold text-slate-650">
                        {selectedApp.id}
                      </span>
                    </p>
                    <p className="text-xs text-slate-550 pt-1">
                      Barangay:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedApp.userBarangay}
                      </span>
                      {(selectedApp.userMunicipality || selectedApp.userProvince) && (
                        <span className="text-slate-400">
                          {" — "}
                          {selectedApp.userMunicipality && `${selectedApp.userMunicipality}`}
                          {selectedApp.userMunicipality && selectedApp.userProvince && ", "}
                          {selectedApp.userProvince}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {selectedApp.documents.picture ? (
                      <img
                        src={selectedApp.documents.picture}
                        alt="Applicant Photo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Document Grid for review */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Evaluate Attached Documentation
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {/* Cedula Doc item */}
                    <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center space-y-3">
                      <div className="flex flex-col items-center">
                        <FileText size={20} className="text-slate-550 mb-1" />
                        <span className="text-xs font-semibold text-slate-800">
                          Cedula
                        </span>
                      </div>
                      {selectedApp.documents.cedula ? (
                        <div className="relative group w-full h-20 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                          <img
                            src={selectedApp.documents.cedula}
                            className="h-full w-full object-contain"
                          />
                          <button
                            onClick={() =>
                              setActivePreviewDoc({
                                title: "Cedula Reference Document",
                                src: selectedApp.documents.cedula!,
                              })
                            }
                            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-[10px] uppercase font-bold cursor-pointer"
                          >
                            <Eye size={12} className="mr-1" />
                            <span>Preview</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                          Incomplete
                        </span>
                      )}
                    </div>

                    {/* Birth Cert Doc item */}
                    <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center space-y-3">
                      <div className="flex flex-col items-center">
                        <FileText size={20} className="text-slate-550 mb-1" />
                        <span className="text-xs font-semibold text-slate-800">
                          Birth Certificate
                        </span>
                      </div>
                      {selectedApp.documents.birthCert ? (
                        <div className="relative group w-full h-20 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                          <img
                            src={selectedApp.documents.birthCert}
                            className="h-full w-full object-contain"
                          />
                          <button
                            onClick={() =>
                              setActivePreviewDoc({
                                title: "Birth Certificate Reference",
                                src: selectedApp.documents.birthCert!,
                              })
                            }
                            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-[10px] uppercase font-bold cursor-pointer"
                          >
                            <Eye size={12} className="mr-1" />
                            <span>Preview</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                          Incomplete
                        </span>
                      )}
                    </div>

                    {/* Barangay Residency Certificate */}
                    <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center space-y-3">
                      <div className="flex flex-col items-center">
                        <FileText size={20} className="text-slate-550 mb-1" />
                        <span className="text-xs font-semibold text-slate-800">
                          Barangay Residency
                        </span>
                      </div>
                      {selectedApp.documents.brgyCert ? (
                        <div className="relative group w-full h-20 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                          <img
                            src={selectedApp.documents.brgyCert}
                            className="h-full w-full object-contain"
                          />
                          <button
                            onClick={() =>
                              setActivePreviewDoc({
                                title: "Barangay Residency Certificate",
                                src: selectedApp.documents.brgyCert!,
                              })
                            }
                            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-[10px] uppercase font-bold cursor-pointer"
                          >
                            <Eye size={12} className="mr-1" />
                            <span>Preview</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-red-150 bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                          Incomplete
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes Input block */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Evaluator Remarks / Justification
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Enter review notes, feedback references, or instructions if disputed..."
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  ></textarea>
                </div>

                {/* Actions Block */}
                <div className="flex items-center space-x-4 pt-2">
                  {/* Staff level options - under review goes to pending */}
                  {profile?.role === "staff" &&
                    selectedApp.status === "under_review" && (
                      <>
                        <button
                          onClick={() => updateStatus("pending")}
                          className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer"
                        >
                          <Check size={16} className="stroke-3" />
                          <span>Confirm and Proceed to Admin</span>
                        </button>

                        <button
                          onClick={() => updateStatus("disputed")}
                          className="flex items-center space-x-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 py-3.5 px-6 text-sm font-semibold transition-all cursor-pointer"
                        >
                          <XCircle size={16} />
                          <span>Dispute / Request updates</span>
                        </button>
                      </>
                    )}

                  {/* Admin level options - pending goes to verified */}
                  {profile?.role === "admin" && (
                    <>
                      {selectedApp.status === "under_review" && (
                        <button
                          onClick={() => updateStatus("pending")}
                          className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer"
                        >
                          <Check size={16} className="stroke-3" />
                          <span>Forward to Admin Hold</span>
                        </button>
                      )}

                      {selectedApp.status === "pending" && (
                        <button
                          onClick={() => updateStatus("verified")}
                          className="flex items-center space-x-2 rounded-xl bg-emerald-700 hover:bg-emerald-900 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-lg border-2 border-emerald-400 cursor-pointer"
                        >
                          <CheckCircle2 size={16} className="text-amber-300" />
                          <span>Verify and Finalize Title Eligibility</span>
                        </button>
                      )}

                      <button
                        onClick={() => updateStatus("disputed")}
                        className="flex items-center space-x-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 py-3.5 px-6 text-sm font-semibold transition-all cursor-pointer"
                      >
                        <XCircle size={16} />
                        <span>Flag as Disputed</span>
                      </button>
                    </>
                  )}

                  {selectedApp.status === "verified" && (
                    <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-200 py-4 px-6 rounded-xl font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>
                        This application has been successfully verified! It is
                        now routed for Surveyor boundary encoding.
                      </span>
                    </div>
                  )}

                  {selectedApp.status === "disputed" && (
                    <button
                      onClick={() => updateStatus("under_review")}
                      className="flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer"
                    >
                      <ArrowRight size={16} />
                      <span>Re-open for Review</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                Select an application record from the left pane to begin manual
                evaluation.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DOCUMENT HIGH-RES PREVIEW MODAL */}
      {activePreviewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-100 overflow-hidden text-left">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {activePreviewDoc.title}
              </h3>
              <button
                onClick={() => setActivePreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none text-xs font-bold bg-slate-200/50 hover:bg-slate-200 px-3 py-1 rounded"
              >
                Close (Esc)
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-slate-950 h-112.5">
              <img
                src={activePreviewDoc.src}
                className="max-h-full max-w-full object-contain rounded"
                alt="Document reference resolution"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import {
  collection,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  addDoc,
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
  Clock,
  ShieldAlert,
  RotateCcw,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
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
  staffNotes: string;
  adminNotes: string;
  reviewedByStaff: string | null;
  staffReviewedAt: string | null;
  approvedByAdmin: string | null;
  adminApprovedAt: string | null;
  arbResponse: string;
  documents: {
    cedula: string | null;
    birthCert: string | null;
    brgyCert: string | null;
    picture: string | null;
  };
  // Internal correction fields (invisible to ARB)
  internalStatus?: string;
  internalNotes?: string;
  internalAssignedTo?: string | null;
  internalAssignedRole?: string | null;
}

interface AuditLog {
  applicationId: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  oldStatus: string | null;
  newStatus: string;
  notes: string;
}

type TabKey =
  | "under_review"
  | "forwarded_to_surveyor"
  | "verified"
  | "resolved";

export const ReviewApps: React.FC = () => {
  const { profile } = useAuth();
  const { writeNotification } = useNotifications();
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesInput, setNotesInput] = useState("");
  const [internalNotesInput, setInternalNotesInput] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showOverride, setShowOverride] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [showReturnSurveyor, setShowReturnSurveyor] = useState(false);
  const [showReturnStaff, setShowReturnStaff] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("under_review");

  const [activePreviewDoc, setActivePreviewDoc] = useState<{
    title: string;
    src: string;
  } | null>(null);

  // Write audit log entry
  const writeAuditLog = async (
    appId: string,
    action: string,
    oldStatus: string | null,
    newStatus: string,
    notes: string,
  ) => {
    await addDoc(collection(db, "auditLogs"), {
      applicationId: appId,
      timestamp: new Date().toISOString(),
      actor: profile?.name || "Unknown",
      actorRole: profile?.role || "unknown",
      action,
      oldStatus,
      newStatus,
      notes: notes.trim(),
    });
  };

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

  // Load audit logs when selected app changes
  useEffect(() => {
    if (!selectedApp) return;
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const logs: AuditLog[] = [];
      snap.forEach((d) => {
        const data = d.data() as AuditLog;
        if (data.applicationId === selectedApp.id) {
          logs.push(data);
        }
      });
      setAuditLogs(logs);
    });

    return () => unsub();
  }, [selectedApp]);

  // Auto-select first app on tab change
  useEffect(() => {
    // Clear remarks whenever tab changes to prevent state bleed
    setNotesInput("");
    setInternalNotesInput("");

    if (selectedApp) {
      const updated = apps.find((a) => a.id === selectedApp.id);
      if (updated && updated.status !== selectedApp.status) {
        setSelectedApp(updated);
      }
      return;
    }

    const defaultSelect = apps.find((a) => {
      if (activeTab === "resolved")
        return a.status === "awarded" || a.status === "disputed";
      return a.status === activeTab;
    });

    if (defaultSelect) {
      setSelectedApp(defaultSelect);
      setNotesInput("");
    } else {
      setSelectedApp(null);
    }
  }, [activeTab, apps]);

  const handleSelectApp = (appItem: Application) => {
    setSelectedApp(appItem);
    setNotesInput("");
    setShowOverride(false);
  };

  const updateStatus = async (newStatus: ApplicationStatus) => {
    if (!selectedApp || !profile) return;

    try {
      setLoading(true);
      const docRef = doc(db, "applications", selectedApp.id);
      const oldStatus = selectedApp.status;

      const payload: Record<string, unknown> = {
        status: newStatus,
      };

      // Separate notes by role
      if (profile.role === "staff") {
        // If forwarding, clear staff notes so surveyor/admin don't see old remarks
        if (newStatus === "forwarded_to_surveyor") {
          payload.staffNotes = "";
        } else {
          payload.staffNotes = notesInput.trim();
        }
        payload.reviewedByStaff = profile.name;
        payload.staffReviewedAt = new Date().toISOString();
      } else if (profile.role === "admin") {
        payload.adminNotes = notesInput.trim();
        payload.approvedByAdmin = profile.name;
        payload.adminApprovedAt = new Date().toISOString();
        // Clear admin notes when awarding so they're not stale on next cycle
        if (newStatus === "awarded") {
          payload.adminNotes = "";
        }
      }

      await updateDoc(docRef, payload);

      // If admin is awarding the title, also update the land title with awardedAt
      if (profile.role === "admin" && newStatus === "awarded") {
        const titleQuery = query(
          collection(db, "landTitles"),
          where("applicationId", "==", selectedApp.id),
        );
        const titleSnap = await getDocs(titleQuery);
        if (!titleSnap.empty) {
          const titleDoc = titleSnap.docs[0];
          await updateDoc(doc(db, "landTitles", titleDoc.id), {
            awardedAt: new Date().toISOString(),
          });
        }
      }

      // Write audit log
      await writeAuditLog(
        selectedApp.id,
        "status_change",
        oldStatus,
        newStatus,
        notesInput,
      );

      // 🔔 NOTIFICATIONS
      if (profile.role === "staff" && newStatus === "forwarded_to_surveyor") {
        // Notify all surveyors
        await writeNotification(
          "surveyor",
          "forwarded",
          "New Land for Surveyor Encoding",
          `Staff ${profile.name} forwarded ${selectedApp.userName}'s application (${selectedApp.id}) for land title encoding.`,
          selectedApp.id,
        );
      } else if (profile.role === "admin" && newStatus === "awarded") {
        // Notify the ARB specifically
        await writeNotification(
          "arb",
          "awarded",
          "CLOA Title Awarded!",
          `Congratulations! Your application ${selectedApp.id} has been approved and your land title has been officially awarded.`,
          selectedApp.id,
          selectedApp.userId,
        );
      } else if (newStatus === "disputed") {
        // Notify ARB
        await writeNotification(
          "arb",
          "disputed",
          "Application Flagged for Review",
          `Your application ${selectedApp.id} has been flagged. See remarks for details.`,
          selectedApp.id,
          selectedApp.userId,
        );
      }
    } catch (err) {
      console.error("Failed to commit status change:", err);
    } finally {
      setLoading(false);
    }
  };

  // Internal correction: admin returns to surveyor or staff (invisible to ARB)
  const handleReturnForCorrection = async (
    assignRole: "surveyor" | "staff",
  ) => {
    if (!selectedApp || !profile || !internalNotesInput.trim()) {
      alert("Please provide internal correction notes.");
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, "applications", selectedApp.id);
      // Also set status back so it appears in the assigned role's queue
      const newStatus =
        assignRole === "surveyor" ? "forwarded_to_surveyor" : "under_review";
      await updateDoc(docRef, {
        status: newStatus,
        internalStatus:
          assignRole === "surveyor"
            ? "correction_surveyor"
            : "correction_staff",
        internalNotes: internalNotesInput.trim(),
        internalAssignedTo: null,
        internalAssignedRole: assignRole,
      });

      await writeAuditLog(
        selectedApp.id,
        "internal_correction",
        selectedApp.status,
        selectedApp.status,
        `Returned to ${assignRole} for correction: ${internalNotesInput.trim()}`,
      );

      await writeNotification(
        assignRole,
        "correction_needed",
        `Correction Needed — ${selectedApp.userName}`,
        `Admin ${profile.name} returned application ${selectedApp.id} for correction: ${internalNotesInput.trim()}`,
        selectedApp.id,
      );

      setInternalNotesInput("");
      setShowReturnSurveyor(false);
      setShowReturnStaff(false);
    } catch (err) {
      console.error("Failed to return for correction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Surveyor/Staff resolves internal correction
  const handleResolveCorrection = async () => {
    if (!selectedApp || !profile) return;
    setLoading(true);
    try {
      const docRef = doc(db, "applications", selectedApp.id);
      await updateDoc(docRef, {
        internalStatus: "ok",
        internalNotes: "",
        internalAssignedTo: null,
        internalAssignedRole: null,
      });

      await writeAuditLog(
        selectedApp.id,
        "correction_resolved",
        selectedApp.status,
        selectedApp.status,
        `${profile.role} resolved correction`,
      );

      await writeNotification(
        "admin",
        "correction_resolved",
        `Correction Resolved — ${selectedApp.userName}`,
        `${profile.role} ${profile.name} resolved the correction for application ${selectedApp.id}. Ready for review.`,
        selectedApp.id,
      );
    } catch (err) {
      console.error("Failed to resolve correction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Revert to previous stage (staff only, guarded)
  const revertToPreviousStatus = async () => {
    if (!selectedApp || !profile) return;
    setConfirmRevert(false);
    setLoading(true);
    const oldStatus = selectedApp.status;
    // Find the previous status from audit trail
    const prevLog = auditLogs.find(
      (l) => l.action === "status_change" && l.newStatus === oldStatus,
    );
    const revertTo =
      (prevLog?.oldStatus as ApplicationStatus) || "under_review";
    const docRef = doc(db, "applications", selectedApp.id);
    await updateDoc(docRef, {
      status: revertTo,
      staffNotes:
        (selectedApp.staffNotes || "") +
        "\n[REVERTED: previous action undone by " +
        (profile.name || "staff") +
        "]",
      reviewedByStaff: profile.name,
      staffReviewedAt: new Date().toISOString(),
    });
    await writeAuditLog(
      selectedApp.id,
      "status_reverted",
      oldStatus,
      revertTo,
      "Staff reverted previous action",
    );
    setLoading(false);
  };

  const getFilteredApps = () => {
    return apps.filter((a) => {
      const matchesTab = (() => {
        if (activeTab === "under_review") return a.status === "under_review";
        if (activeTab === "forwarded_to_surveyor")
          return a.status === "forwarded_to_surveyor";
        if (activeTab === "verified") return a.status === "verified";
        return a.status === "awarded" || a.status === "disputed";
      })();
      if (!matchesTab) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        a.userName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.userBarangay.toLowerCase().includes(q)
      );
    });
  };

  const filteredList = getFilteredApps();

  const tabDefs: { key: TabKey; label: string; color: string }[] = [
    {
      key: "under_review",
      label: "Staff Stage",
      color: "border-emerald-800 text-emerald-800 bg-emerald-50/10",
    },
    {
      key: "forwarded_to_surveyor",
      label: "Surveyor Stage",
      color: "border-amber-600 text-amber-700 bg-amber-50/10",
    },
    {
      key: "verified",
      label: "Admin Stage",
      color: "border-blue-600 text-blue-800 bg-blue-50/10",
    },
    {
      key: "resolved",
      label: "Resolved",
      color: "border-slate-600 text-slate-700 bg-slate-50/10",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR Evaluator Dashboard
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              CLOA Document Processing
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLoading(true);
                // Force re-render which triggers onSnapshot refresh
                setTimeout(() => setLoading(false), 100);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-bold px-2.5 py-1.5 transition-colors cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-100">
              Evaluating role:{" "}
              <span className="uppercase text-amber-600 font-extrabold">
                {profile?.role}
              </span>
            </span>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL */}
          <div className="w-80 border-r border-slate-200 bg-white flex flex-col justify-start">
            <div
              className={`grid grid-cols-4 border-b border-slate-100 text-[10px] font-bold text-center shrink-0`}
            >
              {tabDefs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-3.5 border-b-2 hover:bg-slate-50 transition-colors ${
                    activeTab === tab.key
                      ? tab.color + " font-bold"
                      : "border-transparent text-slate-400 font-medium"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search name, ID, or barangay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 truncate max-w-28">
                          {item.userName}
                        </span>
                        {item.internalStatus &&
                          (item.internalStatus === "correction_surveyor" ||
                            item.internalStatus === "correction_staff") && (
                            <span className="shrink-0 text-[8px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                              !
                            </span>
                          )}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-[10px] text-slate-400">ID: {item.id}</p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      Brgy: {item.userBarangay}
                    </p>
                    {item.internalStatus &&
                      (item.internalStatus === "correction_surveyor" ||
                        item.internalStatus === "correction_staff") && (
                        <p className="text-[9px] text-red-600 font-bold mt-1 flex items-center gap-1">
                          <ArrowLeft size={10} />
                          {item.internalStatus === "correction_surveyor"
                            ? "Returned to Surveyor"
                            : "Returned to Staff"}
                        </p>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
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
                      Ref:{" "}
                      <span className="font-mono font-bold text-slate-650">
                        {selectedApp.id}
                      </span>
                    </p>
                    <p className="text-xs text-slate-550 pt-1">
                      Barangay:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedApp.userBarangay}
                      </span>
                      {(selectedApp.userMunicipality ||
                        selectedApp.userProvince) && (
                        <span className="text-slate-400">
                          {" — "}
                          {selectedApp.userMunicipality}
                          {selectedApp.userProvince &&
                            `, ${selectedApp.userProvince}`}
                        </span>
                      )}
                    </p>
                    {/* Show staff notes to staff/admin */}
                    {selectedApp.staffNotes && (
                      <p className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 rounded-lg mt-2">
                        <span className="font-bold">Staff Remarks:</span>{" "}
                        {selectedApp.staffNotes}
                      </p>
                    )}
                    {selectedApp.adminNotes && (
                      <p className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg mt-1">
                        <span className="font-bold">Admin Remarks:</span>{" "}
                        {selectedApp.adminNotes}
                      </p>
                    )}
                    {selectedApp.arbResponse && (
                      <p className="text-[11px] bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-lg mt-1">
                        <span className="font-bold">ARB Response:</span>{" "}
                        {selectedApp.arbResponse}
                      </p>
                    )}
                  </div>

                  <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {selectedApp.documents.picture ? (
                      <img
                        src={selectedApp.documents.picture}
                        alt="Applicant"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Document Grid */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Evaluate Attached Documentation
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {(["cedula", "birthCert", "brgyCert"] as const).map(
                      (key) => (
                        <div
                          key={key}
                          className="border border-slate-150 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center space-y-3"
                        >
                          <div className="flex flex-col items-center">
                            <FileText
                              size={20}
                              className="text-slate-550 mb-1"
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              {key === "cedula"
                                ? "Cedula"
                                : key === "birthCert"
                                  ? "Birth Certificate"
                                  : "Barangay Residency"}
                            </span>
                          </div>
                          {selectedApp.documents[key] ? (
                            selectedApp.documents[key]!.startsWith(
                              "data:application/pdf",
                            ) ? (
                              <button
                                onClick={() =>
                                  setActivePreviewDoc({
                                    title: key,
                                    src: selectedApp.documents[key]!,
                                  })
                                }
                                className="w-full h-20 bg-white rounded border border-slate-200 flex flex-col items-center justify-center shadow-inner cursor-pointer hover:bg-red-50 transition-colors"
                              >
                                <FileText
                                  size={20}
                                  className="text-red-500 mb-1"
                                />
                                <span className="text-[9px] font-bold text-slate-500 uppercase">
                                  PDF Document
                                </span>
                                <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                  Click to preview
                                </span>
                              </button>
                            ) : (
                              <div className="relative group w-full h-20 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                                <img
                                  src={selectedApp.documents[key]!}
                                  className="h-full w-full object-contain"
                                />
                                <button
                                  onClick={() =>
                                    setActivePreviewDoc({
                                      title: key,
                                      src: selectedApp.documents[key]!,
                                    })
                                  }
                                  className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-[10px] uppercase font-bold cursor-pointer"
                                >
                                  <Eye size={12} className="mr-1" />
                                  <span>Preview</span>
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                              Incomplete
                            </span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* Notes Input */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Evaluator Remarks / Justification
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Enter review notes, feedback, or instructions (required if disputing)..."
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                  ></textarea>
                </div>

                {/* Actions Block */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {/* STAFF: under_review → forward to surveyor or dispute */}
                  {profile?.role === "staff" &&
                    selectedApp.status === "under_review" && (
                      <>
                        <button
                          onClick={() => updateStatus("forwarded_to_surveyor")}
                          className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer"
                        >
                          <Check size={16} className="stroke-3" />
                          <span>Forward for Surveyor Processing</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!notesInput.trim()) {
                              alert(
                                "Please provide remarks explaining the reason for dispute.",
                              );
                              return;
                            }
                            updateStatus("disputed");
                          }}
                          className="flex items-center space-x-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 py-3.5 px-6 text-sm font-semibold transition-all cursor-pointer"
                        >
                          <XCircle size={16} />
                          <span>Dispute / Request Updates</span>
                        </button>
                      </>
                    )}

                  {/* STAFF: disputed → re-open */}
                  {profile?.role === "staff" &&
                    selectedApp.status === "disputed" && (
                      <button
                        onClick={() => updateStatus("under_review")}
                        className="flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer"
                      >
                        <ArrowRight size={16} />
                        <span>Re-open for Review</span>
                      </button>
                    )}

                  {/* STAFF: revert — available on forwarded_to_surveyor or disputed */}
                  {profile?.role === "staff" &&
                    (selectedApp.status === "forwarded_to_surveyor" ||
                      selectedApp.status === "disputed") && (
                      <button
                        onClick={() => setConfirmRevert(true)}
                        className="flex items-center space-x-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3.5 px-4 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <RotateCcw size={14} />
                        <span>Revert to Previous Stage</span>
                      </button>
                    )}

                  {/* STAFF/SURVEYOR: internal correction indicator + resolve button */}
                  {selectedApp.internalStatus &&
                    (selectedApp.internalStatus === "correction_surveyor" ||
                      selectedApp.internalStatus === "correction_staff") && (
                      <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle
                            size={16}
                            className="text-red-600 shrink-0"
                          />
                          <span className="text-xs font-bold text-red-700">
                            Correction Required —{" "}
                            {selectedApp.internalStatus ===
                            "correction_surveyor"
                              ? "Assigned to Surveyor"
                              : "Assigned to Staff"}
                          </span>
                        </div>
                        {selectedApp.internalNotes && (
                          <p className="text-[11px] text-red-600 bg-red-100 px-3 py-2 rounded-lg leading-relaxed">
                            <span className="font-bold">Admin Notes:</span>{" "}
                            {selectedApp.internalNotes}
                          </p>
                        )}
                        {/* Only show resolve button if the current user's role matches the assigned role */}
                        {(selectedApp.internalAssignedRole === "surveyor" &&
                          profile?.role === "surveyor") ||
                        (selectedApp.internalAssignedRole === "staff" &&
                          profile?.role === "staff") ? (
                          <button
                            onClick={handleResolveCorrection}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 px-4 text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            <Check size={14} />
                            <span>Resolve Correction</span>
                          </button>
                        ) : null}
                      </div>
                    )}

                  {/* SURVEYOR: forwarded_to_surveyor info */}
                  {(profile?.role === "staff" || profile?.role === "admin") &&
                    selectedApp.status === "forwarded_to_surveyor" && (
                      <div className="flex items-center space-x-2 text-amber-800 bg-amber-50 border border-amber-200 py-4 px-6 rounded-xl font-semibold text-xs">
                        <Clock size={16} />
                        <span>
                          Awaiting surveyor to encode land title details.
                        </span>
                      </div>
                    )}

                  {/* ADMIN: verified → awarded, dispute, or internal correction */}
                  {profile?.role === "admin" &&
                    selectedApp.status === "verified" && (
                      <>
                        <button
                          onClick={() => updateStatus("awarded")}
                          className="flex items-center space-x-2 rounded-xl bg-emerald-700 hover:bg-emerald-900 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-lg border-2 border-emerald-400 cursor-pointer"
                        >
                          <CheckCircle2 size={16} className="text-amber-300" />
                          <span>Approve & Award Title</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!notesInput.trim()) {
                              alert(
                                "Please provide remarks explaining the reason for dispute.",
                              );
                              return;
                            }
                            updateStatus("disputed");
                          }}
                          className="flex items-center space-x-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 py-3.5 px-6 text-sm font-semibold transition-all cursor-pointer"
                        >
                          <XCircle size={16} />
                          <span>Flag as Disputed</span>
                        </button>
                        <button
                          onClick={() => setShowReturnSurveyor(true)}
                          className="flex items-center space-x-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3.5 px-5 text-sm font-semibold transition-all cursor-pointer"
                        >
                          <ArrowLeft size={16} />
                          <span>Return to Surveyor</span>
                        </button>
                        <button
                          onClick={() => setShowReturnStaff(true)}
                          className="flex items-center space-x-2 rounded-xl border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 py-3.5 px-5 text-sm font-semibold transition-all cursor-pointer"
                        >
                          <ArrowLeft size={16} />
                          <span>Return to Staff</span>
                        </button>
                      </>
                    )}

                  {/* ADMIN override: can also act on under_review, forwarded, disputed */}
                  {profile?.role === "admin" &&
                    selectedApp.status !== "verified" &&
                    selectedApp.status !== "awarded" && (
                      <div className="flex flex-col gap-2">
                        {!showOverride ? (
                          <button
                            onClick={() => setShowOverride(true)}
                            className="flex items-center space-x-2 rounded-xl border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 py-3.5 px-6 text-sm font-semibold transition-all cursor-pointer"
                          >
                            <ShieldAlert size={16} />
                            <span>Admin Override</span>
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <span className="text-[10px] font-bold text-red-700 w-full">
                              ⚠ ADMIN OVERRIDE — use with caution:
                            </span>
                            {selectedApp.status === "under_review" && (
                              <button
                                onClick={() =>
                                  updateStatus("forwarded_to_surveyor")
                                }
                                className="rounded-lg bg-red-600 hover:bg-red-800 text-white py-2 px-4 text-xs font-bold cursor-pointer"
                              >
                                Bypass: Forward to Surveyor
                              </button>
                            )}
                            {selectedApp.status === "forwarded_to_surveyor" && (
                              <button
                                onClick={() => updateStatus("verified")}
                                className="rounded-lg bg-red-600 hover:bg-red-800 text-white py-2 px-4 text-xs font-bold cursor-pointer"
                              >
                                Bypass: Admin Approve
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setShowOverride(false);
                                updateStatus("disputed");
                              }}
                              className="rounded-lg bg-rose-700 hover:bg-rose-900 text-white py-2 px-4 text-xs font-bold cursor-pointer"
                            >
                              Force Dispute
                            </button>
                            <button
                              onClick={() => setShowOverride(false)}
                              className="rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-bold cursor-pointer"
                            >
                              Cancel Override
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Success message for awarded */}
                  {selectedApp.status === "awarded" && (
                    <div className="flex items-center space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-200 py-4 px-6 rounded-xl font-semibold text-xs">
                      <CheckCircle2 size={16} />
                      <span>
                        Title awarded. Land parcel encoded by surveyor.
                      </span>
                    </div>
                  )}
                </div>

                {/* Audit Log History */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Audit Trail / Processing History
                  </h3>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No history recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {auditLogs.map((log, i) => (
                        <div
                          key={i}
                          className="flex items-start space-x-3 text-xs border-l-2 border-slate-200 pl-3 py-1"
                        >
                          <div className="shrink-0">
                            <span className="text-[10px] text-slate-400 block">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">
                              {log.actor}
                            </span>
                            <span className="text-slate-400">
                              {" "}
                              ({log.actorRole}){" "}
                            </span>
                            <span className="text-slate-500">
                              {log.action === "status_change"
                                ? "changed status"
                                : log.action}
                            </span>
                            {log.oldStatus && (
                              <span className="text-slate-400">
                                {" "}
                                from{" "}
                                <span className="font-semibold">
                                  {log.oldStatus.replace(/_/g, " ")}
                                </span>
                              </span>
                            )}
                            <span className="text-slate-400"> → </span>
                            <span className="font-semibold text-emerald-700">
                              {log.newStatus.replace(/_/g, " ")}
                            </span>
                            {log.notes && (
                              <p className="text-[11px] text-slate-500 mt-0.5 italic">
                                "{log.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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

      {/* Revert Confirmation Modal */}
      {confirmRevert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-left space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <RotateCcw size={18} className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Revert Application Status?
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will move the application back to the{" "}
                  <span className="font-bold">previous stage</span>. This action
                  is logged in the audit trail for compliance. Only use this to
                  correct a mistake.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmRevert(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={revertToPreviousStatus}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                Yes, Revert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Surveyor Correction Modal */}
      {showReturnSurveyor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-left space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <ArrowLeft size={18} className="text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Return to Surveyor for Correction
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will internally flag{" "}
                  <span className="font-bold">{selectedApp?.userName}</span>'s
                  application for the surveyor to correct. The applicant will
                  NOT be notified.
                </p>
              </div>
            </div>
            <textarea
              rows={3}
              placeholder="Describe what needs to be corrected (e.g., 'Location coordinates don't match the municipality')..."
              value={internalNotesInput}
              onChange={(e) => setInternalNotesInput(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            ></textarea>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowReturnSurveyor(false);
                  setInternalNotesInput("");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReturnForCorrection("surveyor")}
                disabled={!internalNotesInput.trim() || loading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
              >
                Send to Surveyor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Staff Correction Modal */}
      {showReturnStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-left space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <ArrowLeft size={18} className="text-orange-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Return to Staff for Correction
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will internally flag{" "}
                  <span className="font-bold">{selectedApp?.userName}</span>'s
                  application for the staff to correct. The applicant will NOT
                  be notified.
                </p>
              </div>
            </div>
            <textarea
              rows={3}
              placeholder="Describe what needs to be corrected (e.g., 'Documents are incomplete')..."
              value={internalNotesInput}
              onChange={(e) => setInternalNotesInput(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            ></textarea>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowReturnStaff(false);
                  setInternalNotesInput("");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReturnForCorrection("staff")}
                disabled={!internalNotesInput.trim() || loading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white cursor-pointer disabled:opacity-50"
              >
                Send to Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
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
            <div
              className="p-6 flex items-center justify-center bg-slate-950"
              style={{ minHeight: "400px" }}
            >
              {activePreviewDoc.src.startsWith("data:application/pdf") ? (
                <iframe
                  src={activePreviewDoc.src}
                  title={activePreviewDoc.title}
                  className="w-full h-[70vh] rounded-lg"
                />
              ) : (
                <img
                  src={activePreviewDoc.src}
                  className="max-h-full max-w-full object-contain rounded"
                  alt="Document preview"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

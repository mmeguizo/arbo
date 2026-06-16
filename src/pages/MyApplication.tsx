import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  setDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { TitleMap } from "../components/TitleMap";
import { formatDate } from "../utils/formatters";
import { uploadFile, getDocumentPath, deleteFile } from "../utils/storage";
import {
  FileText,
  CreditCard,
  MapPin,
  AlertCircle,
  Upload,
  Trash2,
  Eye,
  X,
  RotateCcw,
  User,
  ScrollText,
  Printer,
  Camera,
  Calendar,
  ExternalLink,
} from "lucide-react";

type DocField = "birthCert" | "governmentId" | "picture";

interface LandTitle {
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  province?: string;
  geoLat: string;
  geoLng: string;
  encodedAt: string;
  awardedAt?: string;
  beneficiaryName?: string;
  landPhotos?: string[];
  titleType?: string;
  cloaType?: string | null;
  aspPsdNumber?: string;
}

interface ApplicationData {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string;
  staffNotes: string;
  adminNotes: string;
  documents: {
    birthCert: string | null;
    governmentId: string | null;
    picture: string | null;
  };
  notes: string;
}

interface AuditLogEntry {
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  oldStatus: string | null;
  newStatus: string;
  notes: string;
}

export const MyApplication: React.FC = () => {
  const { profile, user } = useAuth();
  const [apps, setApps] = useState<ApplicationData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [titles, setTitles] = useState<LandTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [arbResponse, setArbResponse] = useState("");

  // Derived: current selected app
  const app =
    apps.length > 0 ? apps[Math.min(selectedIdx, apps.length - 1)] : null;

  // Certificate modal state
  const [certificateTitle, setCertificateTitle] = useState<LandTitle | null>(
    null,
  );

  // Audit trail for ARB view
  const [arbAuditLogs, setArbAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Document management state
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    src: string;
  } | null>(null);
  const [updatingDoc, setUpdatingDoc] = useState<DocField | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocField | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Only allow edits before final approval
  const canModify =
    app && app.status !== "verified" && app.status !== "awarded";

  // After modifying a doc, push back to under_review so staff re-evaluates
  const revertedStatus = (): ApplicationStatus => "under_review";

  // Helper to determine if a URL is a PDF (handles Firebase Storage URLs + data URIs)
  const isPDF = (url: string | null): boolean => {
    if (!url) return false;
    // data URI from base64-uploaded PDF
    if (url.startsWith("data:application/pdf")) return true;
    // Firebase Storage URL check: look for parameter-based markers
    if (url.includes("firebasestorage") && url.includes(".pdf")) return true;
    // Generic path-based check
    const lower = url.toLowerCase();
    if (
      lower.endsWith(".pdf") ||
      lower.includes("/pdf") ||
      lower.includes("content-type=application%2Fpdf") ||
      lower.includes("content-type=application/pdf")
    )
      return true;
    // Try detecting contentDisposition for PDF
    if (lower.includes("name%3D.pdf") || lower.includes("name=.pdf"))
      return true;
    return false;
  };

  const handleReplaceDocument = (
    type: DocField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !app || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      setDocError(
        `File is too large (max 10MB). Please choose a smaller file.`,
      );
      e.target.value = "";
      return;
    }
    setDocError(null);
    setUpdatingDoc(type);

    (async () => {
      try {
        const storagePath = getDocumentPath(user.uid, type, file);
        const downloadUrl = await uploadFile(file, storagePath);

        const newStatus = revertedStatus();
        const appRef = doc(db, "applications", app.applicationId);
        await updateDoc(appRef, {
          [`documents.${type}`]: downloadUrl,
          status: newStatus,
        });

        await addDoc(collection(db, "auditLogs"), {
          applicationId: app.applicationId,
          timestamp: new Date().toISOString(),
          actor: profile?.name || "ARB User",
          actorRole: "arb",
          action: "document_updated",
          oldStatus: app.status,
          newStatus,
          notes: `Updated document: ${type}`,
        });

        setApps((prev) =>
          prev.map((a) =>
            a.applicationId === app.applicationId
              ? {
                  ...a,
                  documents: { ...a.documents, [type]: downloadUrl },
                  status: newStatus,
                }
              : a,
          ),
        );
      } catch (err) {
        console.error("Failed to replace document:", err);
        setDocError("Failed to upload document. Please try again.");
      } finally {
        setUpdatingDoc(null);
        e.target.value = "";
      }
    })();
  };

  const handleDeleteDocument = async (type: DocField) => {
    if (!app || !user) return;
    setConfirmDelete(null);
    setUpdatingDoc(type);
    try {
      const existingUrl = app.documents[type];
      if (existingUrl) {
        await deleteFile(existingUrl).catch((e) =>
          console.warn("Could not delete storage file:", e),
        );
      }

      const newStatus = revertedStatus();
      const appRef = doc(db, "applications", app.applicationId);
      await updateDoc(appRef, {
        [`documents.${type}`]: null,
        status: newStatus,
      });
      await addDoc(collection(db, "auditLogs"), {
        applicationId: app.applicationId,
        timestamp: new Date().toISOString(),
        actor: profile?.name || "ARB User",
        actorRole: "arb",
        action: "document_removed",
        oldStatus: app.status,
        newStatus,
        notes: `Removed document: ${type}`,
      });
      setApps((prev) =>
        prev.map((a) =>
          a.applicationId === app.applicationId
            ? {
                ...a,
                documents: { ...a.documents, [type]: null },
                status: newStatus,
              }
            : a,
        ),
      );
    } catch (err) {
      console.error("Failed to delete document:", err);
      setDocError("Failed to remove document. Please try again.");
    } finally {
      setUpdatingDoc(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const q = query(
      collection(db, "applications"),
      where("userId", "==", user.uid),
    );
    const unsubApp = onSnapshot(
      q,
      (snap) => {
        const list: ApplicationData[] = [];
        snap.forEach((d) => {
          const appData = d.data() as ApplicationData;
          list.push({ ...appData, applicationId: d.id });
        });
        list.sort((a, b) =>
          (b.submittedAt || "").localeCompare(a.submittedAt || ""),
        );
        setApps(list);
        if (list.length > 0 && selectedIdx >= list.length) setSelectedIdx(0);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching application:", err);
        setLoading(false);
      },
    );

    const tQ = query(
      collection(db, "landTitles"),
      where("beneficiaryId", "==", user.uid),
    );
    const unsubTitle = onSnapshot(tQ, (snap) => {
      const results: LandTitle[] = [];
      snap.forEach((d) => results.push(d.data() as LandTitle));
      setTitles(results);
    });

    return () => {
      unsubApp();
      unsubTitle();
    };
  }, [user]);

  // Fetch audit logs for the selected app
  useEffect(() => {
    if (!app) return;
    setAuditLoading(true);
    const q = query(
      collection(db, "auditLogs"),
      where("applicationId", "==", app.applicationId),
      orderBy("timestamp", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const logs: AuditLogEntry[] = [];
        snap.forEach((d) => {
          logs.push(d.data() as AuditLogEntry);
        });
        setArbAuditLogs(logs);
        setAuditLoading(false);
      },
      (err) => {
        console.error("Audit log error:", err);
        setAuditLoading(false);
      },
    );
    return () => unsub();
  }, [app?.applicationId]);

  // Print-specific styles injected for certificate printing
  const printCertificate = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
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

        {/* App selector + create new */}
        {!loading && apps.length > 0 && (
          <div className="bg-white border-b border-slate-100 px-8 py-2 flex items-center gap-2 flex-wrap">
            {apps.map((a, i) => (
              <button
                key={a.applicationId}
                onClick={() => setSelectedIdx(i)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  i === selectedIdx
                    ? "bg-emerald-800 text-white border-emerald-800"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {a.applicationId}
                <span className="ml-1 opacity-70">
                  ({a.status.replace(/_/g, " ")})
                </span>
              </button>
            ))}
            {apps[0]?.status === "awarded" || apps[0]?.status === "disputed" ? (
              <button
                onClick={async () => {
                  if (!user) return;
                  const appRefId = `APP-${Math.floor(100000 + Math.random() * 900000)}`;
                  await setDoc(doc(db, "applications", appRefId), {
                    applicationId: appRefId,
                    userId: user.uid,
                    userName: profile?.name || "",
                    userEmail: profile?.email || "",
                    userMunicipality: profile?.municipality || "",
                    userBarangay: profile?.barangay || "",
                    userProvince: profile?.province || "",
                    status: "under_review",
                    submittedAt: new Date().toISOString(),
                    staffNotes: "",
                    adminNotes: "",
                    notes: "",
                    documents: {
                      birthCert: null,
                      governmentId: null,
                      picture: null,
                    },
                  });
                }}
                className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              >
                + New Application
              </button>
            ) : null}
          </div>
        )}

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
          <main className="p-8 space-y-8 max-w-5xl">
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
                      {profile?.name || "Loading profile..."}
                    </h2>
                    <p className="text-xs text-slate-550 mt-1">
                      {profile?.address || profile?.barangay
                        ? `${profile.barangay}, ${profile.municipality || "Negros Occidental"}`
                        : ""}
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
                        {profile?.name ? profile.name.substring(0, 2) : "AR"}
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
                      {profile?.age ?? "—"} years old
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Contact
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.contact || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Barangay
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.barangay || "—"}
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
                          "Your application is under review by DAR municipal staff. They are verifying your credentials and documents."}
                        {app.status === "verified" &&
                          "Staff has verified your documents! Awaiting Admin/Regional Director approval."}
                        {app.status === "awarded" &&
                          "Congratulations! Your CLOA title has been officially awarded. See your land details below."}
                        {app.status === "disputed" &&
                          "Your application has been flagged for review. See remarks below for details on what needs to be corrected."}
                      </p>
                      {(app.status === "disputed" ||
                        app.staffNotes ||
                        app.adminNotes) && (
                        <div className="space-y-1 pt-1">
                          {app.staffNotes && (
                            <p className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1.5 rounded-lg">
                              <span className="font-bold">Staff Remarks:</span>{" "}
                              {app.staffNotes}
                            </p>
                          )}
                          {app.adminNotes && (
                            <p className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg">
                              <span className="font-bold">Admin Remarks:</span>{" "}
                              {app.adminNotes}
                            </p>
                          )}
                        </div>
                      )}
                      {app.status === "disputed" && (
                        <div className="space-y-2 pt-2">
                          <textarea
                            rows={2}
                            placeholder="Respond to the evaluator's remarks (e.g., clarify information, explain corrections)..."
                            value={arbResponse}
                            onChange={(e) => setArbResponse(e.target.value)}
                            className="block w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            onClick={async () => {
                              if (!arbResponse.trim() || !app) return;
                              setLoading(true);
                              const appRef = doc(
                                db,
                                "applications",
                                app.applicationId,
                              );
                              await updateDoc(appRef, {
                                arbResponse: arbResponse.trim(),
                                status: "under_review",
                                staffNotes: "",
                                adminNotes: "",
                              });
                              await addDoc(collection(db, "auditLogs"), {
                                applicationId: app.applicationId,
                                timestamp: new Date().toISOString(),
                                actor: profile?.name || "ARB User",
                                actorRole: "arb",
                                action: "arb_response",
                                oldStatus: "disputed",
                                newStatus: "under_review",
                                notes: `ARB response: ${arbResponse.trim()}`,
                              });
                              setArbResponse("");
                              setLoading(false);
                            }}
                            disabled={loading || !arbResponse.trim()}
                            className="rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            Respond & Resubmit for Review
                          </button>
                        </div>
                      )}
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

            {/* Land titles section — shows ALL awarded titles in a table */}
            {titles.length > 0 ? (
              <div className="bg-white rounded-2xl border border-emerald-250 shadow-sm p-6 text-left space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase bg-emerald-50 text-emerald-800 border-emerald-200 border px-2.5 py-1 rounded inline-block font-extrabold">
                      Certificate of Land Ownership Award (CLOA)
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
                      Awarded Agrarian Land Parcel{titles.length > 1 ? "s" : ""}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {titles.length > 1
                        ? `You have ${titles.length} awarded land titles.`
                        : "Your official title details encoded and verified by the DAR Municipal Encoder."}
                    </p>
                  </div>
                  {titles.length > 1 && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                      {titles.length} titles
                    </span>
                  )}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Title #
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Lot #
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Area (ha)
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Municipality
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Coordinates
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Awarded
                        </th>
                        <th className="pb-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center">
                          CLOA
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {titles.map((t, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                        >
                          <td className="py-3 pr-4 font-extrabold text-slate-800">
                            {t.titleNumber}
                          </td>
                          <td className="py-3 pr-4 font-bold text-slate-700">
                            {t.lotNumber}
                          </td>
                          <td className="py-3 pr-4 font-bold text-emerald-800">
                            {t.areaHectares}
                          </td>
                          <td className="py-3 pr-4 font-medium text-slate-600">
                            {t.municipality}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                            {t.geoLat}, {t.geoLng}
                          </td>
                          <td className="py-3 text-xs text-slate-500">
                            {new Date(t.encodedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-center">
                            {app?.status === "awarded" ? (
                              <button
                                onClick={() => setCertificateTitle(t)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                <Eye size={12} />
                                <span>CLOA</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Pending Admin Approval
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="grid grid-cols-1 sm:hidden gap-4 pt-2">
                  {titles.map((t, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800">
                          {t.titleNumber}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          {t.areaHectares} ha
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span>
                          <span className="font-semibold text-slate-500">
                            Lot:
                          </span>{" "}
                          {t.lotNumber}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-500">
                            Mun:
                          </span>{" "}
                          {t.municipality}
                        </span>
                        <span className="col-span-2 font-mono text-[10px] text-slate-400">
                          {t.geoLat}, {t.geoLng}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Awarded: {new Date(t.encodedAt).toLocaleDateString()}
                      </p>
                      {app?.status === "awarded" ? (
                        <button
                          onClick={() => setCertificateTitle(t)}
                          className="w-full mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>View CLOA Certificate</span>
                        </button>
                      ) : (
                        <p className="w-full mt-1 text-[10px] text-slate-400 italic text-center">
                          Pending Admin Approval
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : app?.status === "verified" || app?.status === "awarded" ? (
              <div className="bg-amber-50 rounded-2xl border border-amber-250 p-6 text-left flex items-start space-x-3.5">
                <AlertCircle
                  size={22}
                  className="text-amber-700 shrink-0 mt-0.5 animate-bounce"
                />
                <div className="space-y-1">
                  <h3 className="font-bold text-amber-900 text-sm">
                    Waiting for Encoder Encoding
                  </h3>
                  <p className="text-xs text-amber-750 leading-relaxed">
                    Great news! Your agrarian documents have been approved by
                    the Admin/Director. We are currently dispatching our
                    municipal encoder to encode your precise geographic lot
                    limits and award your TCT title card in the digital system.
                  </p>
                </div>
              </div>
            ) : app ? (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <MapPin size={24} className="text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-500">
                  No Land Titles Yet
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Once your application is approved and the encoder encodes your
                  land details, your awarded land titles will appear here.
                </p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mt-5">
                  {(
                    [
                      {
                        type: "birthCert" as DocField,
                        label: "Birth Certificate",
                        sub: "Kinship & identity proof",
                        icon: <FileText size={18} className="text-slate-500" />,
                        src: app.documents.birthCert,
                      },
                      {
                        type: "governmentId" as DocField,
                        label: "Government-Issued ID",
                        sub: "Any valid government ID",
                        icon: (
                          <CreditCard size={18} className="text-slate-500" />
                        ),
                        src: app.documents.governmentId,
                      },
                      {
                        type: "picture" as DocField,
                        label: "Profile Picture",
                        sub: "Beneficiary photo",
                        icon: <User size={18} className="text-slate-500" />,
                        src: app.documents.picture,
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

                        {src ? (
                          <button
                            onClick={() => setPreviewDoc({ title: label, src })}
                            className="relative group h-24 w-full bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner cursor-pointer"
                          >
                            {isPDF(src) ? (
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                PDF Document
                              </span>
                            ) : (
                              <img
                                src={src}
                                alt={`${label} preview`}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                  // If image fails to load (might be PDF stored as image), show PDF badge
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                  const parent = (e.target as HTMLImageElement)
                                    .parentElement;
                                  if (parent) {
                                    const badge =
                                      parent.querySelector(".pdf-fallback");
                                    if (badge)
                                      (badge as HTMLElement).style.display =
                                        "flex";
                                  }
                                }}
                              />
                            )}
                            <span className="pdf-fallback text-[10px] font-bold text-slate-500 uppercase hidden">
                              PDF Document
                            </span>
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye size={18} className="text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                            Not uploaded
                          </span>
                        )}

                        {canModify && (
                          <div className="flex items-center justify-center gap-2 w-full pt-1">
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

            {/* Application Audit Trail for ARB */}
            {app && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-700" />
                  Application Audit Trail
                  <span className="ml-1 font-normal normal-case text-slate-400">
                    ({arbAuditLogs.length})
                  </span>
                </h3>
                {auditLoading ? (
                  <p className="text-xs text-slate-400 italic">
                    Loading audit history...
                  </p>
                ) : arbAuditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No processing history recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {arbAuditLogs.map((log, i) => (
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
                              : log.action.replace(/_/g, " ")}
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
            )}

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
            <div className="flex-1 overflow-auto bg-slate-900 flex flex-col items-center justify-center p-6 min-h-80">
              {isPDF(previewDoc.src) ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex items-center gap-2 text-white/70 text-xs">
                    <FileText size={16} />
                    <span>PDF Document</span>
                  </div>
                  <object
                    data={previewDoc.src}
                    type="application/pdf"
                    className="w-full h-[65vh] rounded-lg bg-white"
                  >
                    <div className="text-center py-12 text-white">
                      <p className="text-sm mb-3">
                        PDF preview not available in this browser.
                      </p>
                      <a
                        href={previewDoc.src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 px-4 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye size={14} />
                        Open PDF in New Tab
                      </a>
                    </div>
                  </object>
                  <a
                    href={previewDoc.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-1.5 px-4 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} />
                    Open in new tab
                  </a>
                </div>
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

      {/* CLOA Certificate Modal */}
      {certificateTitle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:block print:static print:z-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-left border border-slate-200 my-auto print:shadow-none print:border-none print:max-w-full print:my-0 print:rounded-none">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-900 text-white sticky top-0 z-10 print:hidden">
              <div className="flex items-center gap-3">
                <ScrollText size={20} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    Certificate of Land Ownership Award (CLOA)
                  </h3>
                  <p className="text-[10px] text-emerald-200 font-mono mt-0.5">
                    {certificateTitle.titleNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCertificateTitle(null)}
                className="text-emerald-200 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-8">
              {/* Certificate Plaque */}
              <div className="bg-[#fdfcf8] border-4 border-emerald-800 rounded-none p-8 md:p-10 text-center relative print:border-4 print:border-emerald-900 print:bg-white print:p-10">
                {/* Outer ornamental border */}
                <div className="absolute inset-2 border-2 border-amber-400/40 pointer-events-none print:border-amber-400/60"></div>

                {/* Top ornamental bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-900 via-amber-500 to-emerald-900 print:h-2 print:from-emerald-900 print:via-amber-500 print:to-emerald-900"></div>
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-900 via-amber-500 to-emerald-900 print:h-2"></div>

                {/* DAR Logo centered */}
                <div className="flex justify-center mb-4">
                  <div className="h-20 w-20 rounded-full bg-white border-2 border-amber-400 flex items-center justify-center shadow-md overflow-hidden print:border-emerald-800">
                    <img
                      src="/dar_logo.png"
                      alt="DAR Official Seal"
                      className="h-full w-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const parent = (e.target as HTMLImageElement)
                          .parentElement;
                        if (parent) {
                          const fallback =
                            parent.querySelector(".logo-fallback");
                          if (fallback)
                            (fallback as HTMLElement).style.display = "flex";
                        }
                      }}
                    />
                    <div className="logo-fallback hidden flex-col items-center justify-center text-center">
                      <p className="text-[12px] leading-4 font-extrabold text-emerald-800">
                        DAR
                      </p>
                      <p className="text-[10px] leading-3 font-semibold text-amber-500">
                        PH
                      </p>
                    </div>
                  </div>
                </div>

                {/* Government Header */}
                <p className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-[0.2em] mb-1">
                  Republic of the Philippines
                </p>
                <h2 className="text-sm md:text-base font-extrabold text-emerald-800 uppercase tracking-wide">
                  Department of Agrarian Reform
                </h2>
                <p className="text-[9px] md:text-[10px] text-slate-500 mt-0.5 uppercase tracking-[0.15em] font-semibold">
                  Negros Occidental & Oriental
                </p>

                <div className="flex items-center justify-center gap-3 my-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400 to-amber-400"></div>
                  <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-[0.25em]">
                    Certificate of Land Ownership Award
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-400 to-amber-400"></div>
                </div>

                <p className="text-xs md:text-sm text-slate-700 leading-relaxed max-w-lg mx-auto">
                  This is to certify that the parcel of agricultural land
                  described herein has been awarded in accordance with Republic
                  Act No. 6657 (Comprehensive Agrarian Reform Law) to
                </p>

                <h3 className="text-xl md:text-2xl font-serif font-extrabold text-emerald-900 mt-3 tracking-tight border-b-2 border-dotted border-amber-400 inline-block px-6 pb-2">
                  {certificateTitle.beneficiaryName || profile?.name}
                </h3>

                <p className="text-[10px] md:text-xs text-slate-500 mt-3 leading-relaxed max-w-lg mx-auto">
                  Herein referred to as an{" "}
                  <span className="font-bold text-slate-700">
                    Agrarian Reform Beneficiary (ARB)
                  </span>
                  , bearing the rights and obligations conferred by the
                  Department of Agrarian Reform under the national agrarian
                  reform program.
                </p>
              </div>

              {/* Title Summary Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden print:border-2 print:border-slate-400">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 print:bg-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Awarded Agrarian Land Parcel
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400 tracking-wider print:bg-slate-100 print:text-slate-600">
                      <tr>
                        <th className="px-5 py-3 text-left">Title #</th>
                        <th className="px-5 py-3 text-left">Lot #</th>
                        <th className="px-5 py-3 text-left">Area (ha)</th>
                        <th className="px-5 py-3 text-left">Municipality</th>
                        <th className="px-5 py-3 text-left">Coordinates</th>
                        <th className="px-5 py-3 text-left">Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="px-5 py-4 font-extrabold text-slate-900">
                          {certificateTitle.titleNumber}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-700">
                          {certificateTitle.lotNumber}
                        </td>
                        <td className="px-5 py-4 font-bold text-emerald-800">
                          {certificateTitle.areaHectares}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-600">
                          {certificateTitle.municipality}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">
                          {certificateTitle.geoLat}, {certificateTitle.geoLng}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatDate(
                            certificateTitle.awardedAt ||
                              certificateTitle.encodedAt,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Map */}
              {certificateTitle.geoLat && certificateTitle.geoLng && (
                <div className="print:hidden">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <MapPin size={14} className="text-emerald-700" />
                    Land Parcel Location
                  </h4>
                  <TitleMap
                    geoLat={certificateTitle.geoLat}
                    geoLng={certificateTitle.geoLng}
                    height={200}
                    interactive={false}
                  />
                </div>
              )}

              {/* Land Photos */}
              {certificateTitle.landPhotos &&
                certificateTitle.landPhotos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Camera size={14} className="text-emerald-700" />
                      Land Photos
                    </h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 print:grid-cols-4">
                      {certificateTitle.landPhotos.map((src, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={src}
                            alt={`Land photo ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Footer note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center print:bg-amber-50/50">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  This digital certificate serves as official proof of CLOA
                  award. The corresponding Original Certificate of Title (OCT)
                  and Transfer Certificate of Title (TCT) are registered with
                  the Land Registration Authority (LRA) under DAR's agrarian
                  reform program.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between sticky bottom-0 print:hidden">
              <button
                onClick={printCertificate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 py-2 px-4 text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Certificate</span>
              </button>
              <button
                onClick={() => setCertificateTitle(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

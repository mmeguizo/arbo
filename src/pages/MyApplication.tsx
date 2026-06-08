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
} from "lucide-react";

type DocField = "cedula" | "birthCert" | "brgyCert" | "picture";

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
}

interface ApplicationData {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string;
  staffNotes: string;
  adminNotes: string;
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
        // 1. Upload file to Firebase Storage
        const storagePath = getDocumentPath(user.uid, type, file);
        const downloadUrl = await uploadFile(file, storagePath);

        const newStatus = revertedStatus();
        const appRef = doc(db, "applications", app.applicationId);
        await updateDoc(appRef, {
          [`documents.${type}`]: downloadUrl,
          status: newStatus,
        });

        // Audit log for document upload
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

        // Optimistic local update so UI updates immediately
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
      // Delete from Storage if URL exists
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
      // Audit log for document removal
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
      // Optimistic local update so UI updates immediately
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

    // 1. Real-time listener for ALL user's applications
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
        // Sort newest first
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

    // 2. Real-time listener for all land titles (ARB can have multiple)
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
            {/* Show "Create New" if first app is awarded or disputed */}
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
                      cedula: null,
                      birthCert: null,
                      brgyCert: null,
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
                          "Your application is under review by DAR municipal staff. They are verifying your credentials and documents."}
                        {app.status === "forwarded_to_surveyor" &&
                          "Staff has verified your documents! Forwarded to the surveyor team for land title encoding."}
                        {app.status === "verified" &&
                          "Surveyor has encoded your land details. Awaiting Admin/Regional Director approval."}
                        {app.status === "awarded" &&
                          "Congratulations! Your CLOA title has been officially awarded. See your land details below."}
                        {app.status === "disputed" &&
                          "Your application has been flagged for review. See remarks below for details on what needs to be corrected."}
                      </p>
                      {/* Show remarks if disputed or if any remarks exist */}
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
                      {/* ARB response box when disputed */}
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
                                // Clear old evaluator remarks so they don't confuse the next evaluator
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
                            Respond &amp; Resubmit for Review
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
                        : "Your official title details encoded and verified by the DAR Municipal Surveyor."}
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
                            <button
                              onClick={() => setCertificateTitle(t)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
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
                      <button
                        onClick={() => setCertificateTitle(t)}
                        className="w-full mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>View CLOA Certificate</span>
                      </button>
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
            ) : app ? (
              /* No land titles yet — show empty state */
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <MapPin size={24} className="text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-500">
                  No Land Titles Yet
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Once your application is approved and the surveyor encodes
                  your land details, your awarded land titles will appear here.
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

                {/* Document cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 mt-5">
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

      {/* CLOA Certificate Modal */}
      {certificateTitle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-left border border-slate-200 my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-900 text-white sticky top-0 z-10">
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

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Certificate Hero */}
              <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 border-2 border-emerald-200 rounded-2xl p-8 text-center relative overflow-hidden">
                {/* Decorative border */}
                <div className="absolute inset-0 border-4 border-emerald-800/10 rounded-2xl pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-800 via-amber-500 to-emerald-800"></div>

                {/* Seal */}
                <div className="h-16 w-16 rounded-full bg-emerald-800 flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-amber-400">
                  <div className="text-center text-white">
                    <p className="text-[8px] leading-3 font-extrabold tracking-wider">
                      DAR
                    </p>
                    <p className="text-[6px] leading-3 font-semibold text-amber-300">
                      PH
                    </p>
                  </div>
                </div>

                <h2 className="text-lg font-extrabold text-emerald-900 uppercase tracking-wide">
                  Republic of the Philippines
                </h2>
                <p className="text-xs font-bold text-emerald-700 mt-1">
                  Department of Agrarian Reform
                </p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">
                  Certificate of Land Ownership Award (CLOA)
                </p>

                <div className="w-24 h-0.5 bg-amber-400 mx-auto my-4"></div>

                <p className="text-sm font-bold text-slate-700">
                  This certifies that the parcel of land described below has
                  been awarded to
                </p>
                <h3 className="text-xl font-extrabold text-emerald-900 mt-2 tracking-tight">
                  {certificateTitle.beneficiaryName || profile?.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  As an Agrarian Reform Beneficiary (ARB) under the
                  Comprehensive Agrarian Reform Program
                </p>
              </div>

              {/* Title Summary Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Awarded Agrarian Land Parcel
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400 tracking-wider">
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
              {certificateTitle.geoLat && certificateTitle.geoLat && (
                <div>
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
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
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
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between sticky bottom-0">
              <button
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 py-2 px-4 text-xs font-bold transition-colors cursor-pointer"
              >
                <Printer size={14} />
                <span>Print</span>
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

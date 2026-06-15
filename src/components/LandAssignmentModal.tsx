import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { broadcastNotification } from "../contexts/NotificationContext";
import {
  Search,
  MapPin,
  Hash,
  Layers,
  FileCheck,
  AlertCircle,
  Check,
  X,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface AvailableTitle {
  titleId: string;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  province: string;
  titleType?: string;
  cloaType?: string | null;
  aspPsdNumber?: string;
  status: string;
  encodedAt: string;
  encoderId: string;
  // For already-assigned CLOA-TCT titles (splittable)
  assignedTo?: string;
  assignedName?: string;
  existingPsdNumbers?: string[];
}

interface LandAssignmentModalProps {
  applicationId: string;
  applicantName: string;
  applicantUserId: string;
  onClose: () => void;
  onAssigned: (titleNumber: string) => void;
}

export const LandAssignmentModal: React.FC<LandAssignmentModalProps> = ({
  applicationId,
  applicantName,
  applicantUserId,
  onClose,
  onAssigned,
}) => {
  const { profile } = useAuth();
  const [titles, setTitles] = useState<AvailableTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<AvailableTitle | null>(
    null,
  );
  const [psdInput, setPsdInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch available titles
  useEffect(() => {
    const fetchTitles = async () => {
      try {
        setLoading(true);

        // Query unassigned titles
        const unassignedQ = query(
          collection(db, "landTitles"),
          where("status", "==", "unassigned"),
        );
        const unassignedSnap = await getDocs(unassignedQ);
        const unassignedList: AvailableTitle[] = [];
        unassignedSnap.forEach((d) => {
          const data = d.data();
          unassignedList.push({
            titleId: d.id,
            titleNumber: data.titleNumber || "",
            lotNumber: data.lotNumber || "",
            areaHectares: data.areaHectares || 0,
            municipality: data.municipality || "",
            province: data.province || "",
            titleType: data.titleType || "tct",
            cloaType: data.cloaType || null,
            aspPsdNumber: data.aspPsdNumber || "",
            status: data.status || "unassigned",
            encodedAt: data.encodedAt || "",
            encoderId: data.encoderId || "",
          });
        });

        // Also query CLOA-TCT titles that are assigned but can be split
        // (CLOA-TCT can be assigned to multiple ARBs with different PSD numbers)
        const cloaTctQ = query(
          collection(db, "landTitles"),
          where("titleType", "==", "cloa-tct"),
          where("status", "==", "assigned"),
        );
        const cloaTctSnap = await getDocs(cloaTctQ);

        // Gather existing PSD assignments for each CLOA-TCT
        const allAssignmentsSnap = await getDocs(collection(db, "landTitles"));
        const psdMap = new Map<string, string[]>();
        for (const d of cloaTctSnap.docs) {
          const titleNumber = d.data().titleNumber;
          if (titleNumber) {
            const existingPsds: string[] = [];
            allAssignmentsSnap.forEach((ad) => {
              const adata = ad.data();
              if (adata.titleNumber === titleNumber && adata.aspPsdNumber) {
                existingPsds.push(adata.aspPsdNumber);
              }
            });
            psdMap.set(titleNumber, existingPsds);
          }
        }

        const cloaTctList: AvailableTitle[] = [];
        cloaTctSnap.forEach((d) => {
          const data = d.data();
          const titleNumber = data.titleNumber || "";
          cloaTctList.push({
            titleId: d.id,
            titleNumber,
            lotNumber: data.lotNumber || "",
            areaHectares: data.areaHectares || 0,
            municipality: data.municipality || "",
            province: data.province || "",
            titleType: "cloa-tct",
            cloaType: data.cloaType || null,
            aspPsdNumber: data.aspPsdNumber || "",
            status: "assigned",
            encodedAt: data.encodedAt || "",
            encoderId: data.encoderId || "",
            assignedTo: data.beneficiaryId || "",
            assignedName: data.beneficiaryName || "",
            existingPsdNumbers: psdMap.get(titleNumber) || [],
          });
        });

        setTitles([...unassignedList, ...cloaTctList]);
      } catch (err) {
        console.error("Failed to fetch available titles:", err);
        setError("Failed to load available land titles. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTitles();
  }, []);

  const filteredTitles = titles.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.titleNumber.toLowerCase().includes(q) ||
      t.municipality.toLowerCase().includes(q) ||
      t.lotNumber.toLowerCase().includes(q) ||
      (t.aspPsdNumber || "").toLowerCase().includes(q)
    );
  });

  const handleAssign = async () => {
    if (!selectedTitle || !profile) return;

    // Validate TCT reassignment
    if (
      selectedTitle.titleType === "tct" &&
      selectedTitle.status === "assigned"
    ) {
      setError(
        `TCT Title "${selectedTitle.titleNumber}" is already assigned to ${selectedTitle.assignedName || "another ARB"}. TCT titles cannot be reassigned.`,
      );
      await broadcastNotification(
        "staff",
        "blocked",
        "TCT Reassignment Blocked",
        `Staff ${profile.name} attempted to reassign TCT "${selectedTitle.titleNumber}" which is already assigned to ${selectedTitle.assignedName || "another beneficiary"}.`,
        applicationId,
      );
      return;
    }

    // For CLOA-TCT, PSD input is required
    if (selectedTitle.titleType === "cloa-tct" && !psdInput.trim()) {
      setError("Please enter an ASP/PSD number for this CLOA-TCT assignment.");
      return;
    }

    // Check duplicate PSD for CLOA-TCT
    if (
      selectedTitle.titleType === "cloa-tct" &&
      selectedTitle.existingPsdNumbers?.some(
        (p) => p.toLowerCase() === psdInput.trim().toLowerCase(),
      )
    ) {
      setError(
        `PSD number "${psdInput.trim()}" is already assigned for CLOA "${selectedTitle.titleNumber}". Please use a different PSD number.`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const now = new Date().toISOString();

      // If unassigned title, assign it
      if (selectedTitle.status === "unassigned") {
        const titleRef = doc(db, "landTitles", selectedTitle.titleId);
        await updateDoc(titleRef, {
          applicationId,
          beneficiaryId: applicantUserId,
          beneficiaryName: applicantName,
          status: "assigned",
          assignedAt: now,
          assignedBy: profile.name,
          ...(psdInput.trim() ? { aspPsdNumber: psdInput.trim() } : {}),
        });
      }
      // If CLOA-TCT already assigned, create a new title record for this split
      else if (selectedTitle.titleType === "cloa-tct") {
        const newTitleId = `TTL-${Math.floor(100000 + Math.random() * 900000)}`;
        await addDoc(collection(db, "landTitles"), {
          ...selectedTitle,
          titleId: newTitleId,
          applicationId,
          beneficiaryId: applicantUserId,
          beneficiaryName: applicantName,
          status: "assigned",
          assignedAt: now,
          assignedBy: profile.name,
          aspPsdNumber: psdInput.trim(),
          // Don't carry over landPhotos to the split record
          landPhotos: [],
        });
      }

      // Update application status to verified
      const appRef = doc(db, "applications", applicationId);
      await updateDoc(appRef, {
        status: "verified",
        staffNotes: "",
        reviewedByStaff: profile.name,
        staffReviewedAt: now,
      });

      // Write audit log
      await addDoc(collection(db, "auditLogs"), {
        applicationId,
        timestamp: now,
        actor: profile.name || "Unknown",
        actorRole: "staff",
        action: "land_assigned",
        oldStatus: "under_review",
        newStatus: "verified",
        notes: `Staff ${profile.name} assigned title ${selectedTitle.titleNumber}${psdInput ? ` (PSD: ${psdInput.trim()})` : ""} to ${applicantName} (${applicationId}).`,
      });

      await broadcastNotification(
        "admin",
        "forwarded",
        "Land Title Assigned — Ready for Admin",
        `Staff ${profile.name} assigned title ${selectedTitle.titleNumber} to ${applicantName}. Application ${applicationId} is now ready for admin approval.`,
        applicationId,
      );

      setSuccess(true);
      setTimeout(() => {
        onAssigned(selectedTitle.titleNumber);
      }, 1500);
    } catch (err) {
      console.error("Failed to assign title:", err);
      setError("Failed to assign land title. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTitleBadge = (titleType?: string) => {
    switch (titleType) {
      case "tct":
        return (
          <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            TCT
          </span>
        );
      case "cloa":
        return (
          <span className="text-[9px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            CLOA
          </span>
        );
      case "cloa-tct":
        return (
          <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            CLOA-TCT
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Assign Land Title
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigning to:{" "}
              <span className="font-bold text-slate-700">{applicantName}</span>{" "}
              ({applicationId})
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Success state */}
          {success && (
            <div className="rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-sm text-emerald-800 text-center">
              <Check size={24} className="mx-auto mb-2 text-emerald-600" />
              <span className="font-bold block">
                Title Assigned Successfully!
              </span>
              <span className="text-xs text-emerald-700 mt-1 block">
                Forwarding to admin for final approval...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start space-x-2.5 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-500">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {!success && (
            <>
              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title number, municipality, lot, or PSD..."
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                />
              </div>

              {/* Title List */}
              {loading ? (
                <div className="py-8 text-center text-slate-400 italic text-xs">
                  Loading available titles...
                </div>
              ) : filteredTitles.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 italic text-xs">
                  No available titles found. Ensure encoders have created
                  unassigned titles in the Land Titles page.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredTitles.map((t) => {
                    const isSelected = selectedTitle?.titleId === t.titleId;
                    const isSplittable =
                      t.titleType === "cloa-tct" && t.status === "assigned";

                    return (
                      <button
                        key={t.titleId}
                        type="button"
                        onClick={() => {
                          setSelectedTitle(t);
                          setPsdInput("");
                          setError(null);
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-extrabold text-slate-900">
                                {t.titleNumber}
                              </span>
                              {getTitleBadge(t.titleType)}
                              {isSplittable && (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                  Splittable
                                </span>
                              )}
                              {t.status === "unassigned" && (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  Unassigned
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {t.municipality}
                              </span>
                              <span className="flex items-center gap-1">
                                <Layers size={12} />
                                Lot {t.lotNumber}
                              </span>
                              <span>{t.areaHectares} ha</span>
                            </div>
                            {t.cloaType && (
                              <span className="text-[10px] text-slate-400">
                                CLOA Type:{" "}
                                {t.cloaType === "split"
                                  ? "Split"
                                  : "Field Survey"}
                              </span>
                            )}
                            {t.aspPsdNumber && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Hash size={10} />
                                {t.aspPsdNumber}
                              </span>
                            )}
                            {isSplittable &&
                              t.existingPsdNumbers &&
                              t.existingPsdNumbers.length > 0 && (
                                <div className="text-[10px] text-amber-600 mt-1">
                                  Already assigned PSDs:{" "}
                                  {t.existingPsdNumbers.join(", ")}
                                </div>
                              )}
                          </div>
                          <div className="shrink-0">
                            {isSelected ? (
                              <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check size={14} className="text-white" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full border-2 border-slate-200" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* PSD Input for CLOA-TCT */}
              {selectedTitle?.titleType === "cloa-tct" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    ASP / PSD Number (required for CLOA-TCT split)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Hash size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={psdInput}
                      onChange={(e) => setPsdInput(e.target.value)}
                      placeholder="PSD-05-123456"
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedTitle || submitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-900 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {submitting ? (
                "Assigning..."
              ) : (
                <>
                  <span>Assign Land & Forward to Admin</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

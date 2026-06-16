import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { uploadFile } from "../utils/storage";
import { formatDate } from "../utils/formatters";
import {
  DollarSign,
  Package,
  FileText,
  Upload,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  X,
  File,
  Building2,
  Landmark,
  Wrench,
} from "lucide-react";

interface Grant {
  id: string;
  type: "cash" | "raw_materials" | "loan" | "equipment";
  description: string;
  amount: number;
  unit: string;
  dateProvided: string;
  reportCycle: "6_months" | "1_year";
  nextReportDue: string;
  status: "active" | "completed" | "overdue";
  createdAt: string;
  cooperativeId?: string;
  cooperativeName?: string;
  isCoopGrant?: boolean;
  interestRate?: number;
  loanTermMonths?: number;
  remainingBalance?: number;
  equipmentItem?: string;
  equipmentQuantity?: number;
  unitValue?: number;
}

interface GrantReport {
  id: string;
  grantId: string;
  reportDate: string;
  period: string;
  notes: string;
  images: string[];
  documents: string[];
  incomeGenerated: number;
  harvestYield: string;
  receiptAmount: number;
  status: "submitted" | "reviewed";
  createdAt: string;
}

export const GrantCard: React.FC<{
  grant: Grant;
  expandedGrant: string | null;
  setExpandedGrant: (id: string | null) => void;
  showReportModal: string | null;
  setShowReportModal: (id: string | null) => void;
  setPreviewImage: (src: string | null) => void;
}> = ({
  grant,
  expandedGrant,
  setExpandedGrant,
  showReportModal,
  setShowReportModal,
  setPreviewImage,
}) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<GrantReport[]>([]);

  // Report form state - local to this component to prevent parent re-renders
  const [reportNotes, setReportNotes] = useState("");
  const [reportIncome, setReportIncome] = useState("");
  const [reportHarvest, setReportHarvest] = useState("");
  const [reportReceipt, setReportReceipt] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"6_months" | "1_year">(
    grant.reportCycle === "6_months" ? "6_months" : "1_year",
  );
  const [uploading, setUploading] = useState(false);
  const [reportImages, setReportImages] = useState<string[]>([]);
  const [reportDocs, setReportDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Load reports for this specific grant (not all user reports)
  React.useEffect(() => {
    setReportsLoading(true);
    const q = query(
      collection(db, "grantReports"),
      where("grantId", "==", grant.id),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: GrantReport[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            grantId: data.grantId,
            reportDate: data.reportDate,
            period: data.period,
            notes: data.notes,
            images: data.images || [],
            documents: data.documents || [],
            incomeGenerated: data.incomeGenerated || 0,
            harvestYield: data.harvestYield || "",
            receiptAmount: data.receiptAmount || 0,
            status: data.status || "submitted",
            createdAt: data.createdAt,
          });
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setReports(list);
        setReportsLoading(false);
      },
      (err) => {
        console.error(err);
        setReportsLoading(false);
      },
    );
    return () => unsub();
  }, [grant.id]);

  const handleFileUpload = async (
    file: File,
    type: "image" | "document",
  ): Promise<string> => {
    const folder = type === "image" ? "grant-images" : "grant-documents";
    const path = `grants/${user!.uid}/${folder}/${Date.now()}_${file.name}`;
    const url = await uploadFile(file, path);
    return url;
  };

  const submitReport = async () => {
    if (!user) return;
    setError(null);
    setUploading(true);
    try {
      const periodLabel =
        reportPeriod === "6_months" ? "6 Month Report" : "Year 1 Report";

      await addDoc(collection(db, "grantReports"), {
        grantId: grant.id,
        beneficiaryId: user.uid,
        reportDate: new Date().toISOString(),
        period: periodLabel,
        notes: reportNotes.trim(),
        images: reportImages,
        documents: reportDocs,
        incomeGenerated: parseFloat(reportIncome) || 0,
        harvestYield: reportHarvest.trim(),
        receiptAmount: parseFloat(reportReceipt) || 0,
        status: "submitted",
        createdAt: new Date().toISOString(),
      });

      // Reset form
      setShowReportModal(null);
      setReportNotes("");
      setReportIncome("");
      setReportHarvest("");
      setReportReceipt("");
      setReportImages([]);
      setReportDocs([]);
      setReportPeriod(grant.reportCycle === "6_months" ? "6_months" : "1_year");
    } catch (err) {
      console.error(err);
      setError("Failed to submit report. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const isExpanded = expandedGrant === grant.id;
  const isReportModalOpen = showReportModal === grant.id;
  const cycleLabel = grant.reportCycle === "6_months" ? "6 Months" : "1 Year";

  const statusIcon =
    grant.status === "active" ? (
      <Clock size={14} className="text-emerald-600" />
    ) : grant.status === "overdue" ? (
      <AlertCircle size={14} className="text-red-500" />
    ) : (
      <CheckCircle2 size={14} className="text-blue-600" />
    );
  const statusColor =
    grant.status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : grant.status === "overdue"
        ? "bg-red-100 text-red-800"
        : "bg-blue-100 text-blue-800";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Grant Header */}
      <div
        onClick={() => setExpandedGrant(isExpanded ? null : grant.id)}
        className="p-5 flex items-start justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
              grant.type === "cash"
                ? "bg-emerald-100 text-emerald-700"
                : grant.type === "loan"
                  ? "bg-indigo-100 text-indigo-700"
                  : grant.type === "equipment"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-amber-100 text-amber-700"
            }`}
          >
            {grant.type === "cash" ? (
              <DollarSign size={22} />
            ) : grant.type === "loan" ? (
              <Landmark size={22} />
            ) : grant.type === "equipment" ? (
              <Wrench size={22} />
            ) : (
              <Package size={22} />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  grant.type === "cash"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : grant.type === "loan"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : grant.type === "equipment"
                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {grant.type === "cash"
                  ? "Cash Grant"
                  : grant.type === "loan"
                    ? "Loan"
                    : grant.type === "equipment"
                      ? "Equipment"
                      : "Raw Materials"}
              </span>
              {grant.isCoopGrant && grant.cooperativeName && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Building2 size={10} />
                  {grant.cooperativeName}
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${statusColor}`}
              >
                {statusIcon}
                {grant.status.charAt(0).toUpperCase() + grant.status.slice(1)}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {grant.type === "cash"
                ? `₱${grant.amount.toLocaleString()} ${grant.unit || "PHP"}`
                : grant.type === "loan"
                  ? `₱${grant.amount.toLocaleString()} · ${grant.interestRate ?? 0}% · ${grant.loanTermMonths ?? 12}mo`
                  : grant.type === "equipment"
                    ? `${grant.equipmentQuantity ?? 1}x ${grant.equipmentItem || "Equipment"}`
                    : `${grant.amount} ${grant.unit || "units"}`}
            </h3>
            {grant.type === "loan" && grant.remainingBalance !== undefined && (
              <p className="text-[10px] text-indigo-600 mt-0.5">
                Remaining: ₱{grant.remainingBalance.toLocaleString()}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              {grant.description || "No description"}
            </p>
          </div>
        </div>
        <button className="text-slate-400 p-1">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Provided On
              </span>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                <Calendar size={12} />
                {formatDate(grant.dateProvided)}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Report Cycle
              </span>
              <span className="text-xs font-bold text-slate-700">
                Every {cycleLabel}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Next Report Due
              </span>
              <span className="text-xs font-bold text-slate-700">
                {formatDate(grant.nextReportDue)}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 uppercase font-bold block">
                Reports Submitted
              </span>
              <span className="text-xs font-bold text-slate-700">
                {reports.length}
              </span>
            </div>
          </div>

          {/* Reports Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Submitted Reports ({reports.length})
            </h4>
            {reportsLoading ? (
              <p className="text-xs text-slate-400 italic">
                Loading reports...
              </p>
            ) : reports.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No reports submitted yet. Click the button below to submit your
                first progress report.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">
                          {r.period}
                        </span>
                        <span className="text-slate-400">
                          · {formatDate(r.reportDate)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {r.status}
                      </span>
                    </div>
                    {r.incomeGenerated > 0 && (
                      <p className="text-slate-600 mb-1">
                        Income: ₱{r.incomeGenerated.toLocaleString()}
                      </p>
                    )}
                    {r.harvestYield && (
                      <p className="text-slate-600 mb-1">
                        Harvest: {r.harvestYield}
                      </p>
                    )}
                    {r.receiptAmount > 0 && (
                      <p className="text-slate-600 mb-1">
                        Receipts: ₱{r.receiptAmount.toLocaleString()}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-slate-500 italic mt-1">"{r.notes}"</p>
                    )}
                    {r.images.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {r.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setPreviewImage(img)}
                            className="h-14 w-14 rounded-lg border border-slate-200 overflow-hidden bg-white hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {r.documents.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {r.documents.map((doc, i) => (
                          <a
                            key={i + r.id}
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <File size={12} />
                            Doc {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Report Button */}
          <button
            onClick={() => {
              setShowReportModal(grant.id);
              setReportPeriod(
                grant.reportCycle === "6_months" ? "6_months" : "1_year",
              );
              setReportNotes("");
              setReportIncome("");
              setReportHarvest("");
              setReportReceipt("");
              setReportImages([]);
              setReportDocs([]);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-2.5 px-5 text-xs font-bold transition-all cursor-pointer"
          >
            <Upload size={14} />
            Submit Progress Report
          </button>
        </div>
      )}

      {/* Report Submission Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 my-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-700" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Submit Progress Report
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {grant.type === "cash"
                      ? "Cash Grant"
                      : grant.type === "loan"
                        ? "Loan"
                        : grant.type === "equipment"
                          ? "Equipment"
                          : "Raw Materials"}
                    {grant.isCoopGrant && ` · ${grant.cooperativeName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(null)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Period Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Reporting Period
                </label>
                <div className="flex gap-2">
                  {grant.reportCycle === "6_months" && (
                    <button
                      onClick={() => setReportPeriod("6_months")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        reportPeriod === "6_months"
                          ? "bg-emerald-800 text-white border-emerald-800"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      6 Month Report
                    </button>
                  )}
                  <button
                    onClick={() => setReportPeriod("1_year")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      reportPeriod === "1_year"
                        ? "bg-emerald-800 text-white border-emerald-800"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    1 Year Report
                  </button>
                </div>
              </div>

              {/* Cash-specific fields */}
              {grant.type === "cash" && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Income Generated (₱)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 15000"
                      value={reportIncome}
                      onChange={(e) => setReportIncome(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Receipt/Expense Documentation Total (₱)
                    </label>
                    <input
                      type="number"
                      placeholder="Total receipt amounts"
                      value={reportReceipt}
                      onChange={(e) => setReportReceipt(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {/* Raw materials specific fields */}
              {grant.type === "raw_materials" && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Harvest / Yield Details
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 50 sacks of rice, 200 kg corn"
                      value={reportHarvest}
                      onChange={(e) => setReportHarvest(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Estimated Income from Harvest (₱)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g., 25000"
                      value={reportIncome}
                      onChange={(e) => setReportIncome(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your progress, challenges, or any additional information..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Upload Images
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {reportImages.map((src, i) => (
                    <div
                      key={i}
                      className="relative h-16 w-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50"
                    >
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() =>
                          setReportImages(
                            reportImages.filter((_, j) => j !== i),
                          )
                        }
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] hover:bg-red-600 cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <label className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors">
                    <Plus size={18} className="text-slate-400" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const url = await handleFileUpload(file, "image");
                          setReportImages((prev) => [...prev, url]);
                        } catch {
                          setError("Failed to upload image");
                        }
                        setUploading(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Document Upload */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Upload Documents (PDF, spreadsheets, etc.)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {reportDocs.map((_src, i) => (
                    <div
                      key={i}
                      className="relative inline-flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600"
                    >
                      <File size={12} />
                      <span>Doc {i + 1}</span>
                      <button
                        onClick={() =>
                          setReportDocs(reportDocs.filter((_, j) => j !== i))
                        }
                        className="ml-1 text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 px-3 text-[10px] font-bold text-slate-500 cursor-pointer hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors">
                    <Upload size={12} />
                    Add Document
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const url = await handleFileUpload(file, "document");
                          setReportDocs((prev) => [...prev, url]);
                        } catch {
                          setError("Failed to upload document");
                        }
                        setUploading(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowReportModal(null)}
                className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 py-2 px-4 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={
                  uploading ||
                  (!reportNotes.trim() && !reportIncome && !reportHarvest)
                }
                className="rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

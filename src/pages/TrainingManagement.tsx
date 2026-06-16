import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { formatDate } from "../utils/formatters";
import {
  GraduationCap,
  Plus,
  X,
  Search,
  Calendar,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Training {
  id: string;
  name: string;
  purpose: string;
  date: string;
  status: "ongoing" | "completed";
  documentLinks: string[];
  assignedTo: "cooperative" | "individuals";
  assignedCoopIds: string[];
  assignedUserIds: string[];
  createdAt: string;
  createdBy: string;
}

interface TrainingAck {
  id: string;
  trainingId: string;
  userId: string;
  userName: string;
  status: "pending" | "acknowledged" | "declined";
  reason?: string;
  acknowledgedAt?: string;
}

interface ARBUser {
  uid: string;
  name: string;
  municipality: string;
  barangay: string;
}

interface CoopRecord {
  id: string;
  name: string;
  municipality: string;
}

export const TrainingManagement: React.FC = () => {
  const { profile } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [acks, setAcks] = useState<TrainingAck[]>([]);
  const [arbUsers, setArbUsers] = useState<ARBUser[]>([]);
  const [cooperatives, setCooperatives] = useState<CoopRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ongoing" | "completed"
  >("all");
  const [expandedTraining, setExpandedTraining] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPurpose, setFormPurpose] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStatus, setFormStatus] = useState<"ongoing" | "completed">(
    "ongoing",
  );
  const [formLinks, setFormLinks] = useState<string[]>([""]);
  const [formAssignedTo, setFormAssignedTo] = useState<
    "cooperative" | "individuals"
  >("individuals");
  const [formSelectedCoops, setFormSelectedCoops] = useState<string[]>([]);
  const [formSelectedUsers, setFormSelectedUsers] = useState<string[]>([]);
  const [formUserSearch, setFormUserSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load data
  useEffect(() => {
    const unsubTrainings = onSnapshot(
      query(collection(db, "trainings"), orderBy("date", "asc")),
      (snap) => {
        const list: Training[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || "",
            purpose: data.purpose || "",
            date: data.date || "",
            status: data.status || "ongoing",
            documentLinks: data.documentLinks || [],
            assignedTo: data.assignedTo || "individuals",
            assignedCoopIds: data.assignedCoopIds || [],
            assignedUserIds: data.assignedUserIds || [],
            createdAt: data.createdAt || "",
            createdBy: data.createdBy || "",
          });
        });
        setTrainings(list);
        setLoading(false);
      },
    );

    const unsubAcks = onSnapshot(
      collection(db, "trainingAcknowledgments"),
      (snap) => {
        const list: TrainingAck[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({ id: d.id, ...data } as TrainingAck);
        });
        setAcks(list);
      },
    );

    const unsubARBs = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["arb", "arbo_head"])),
      (snap) => {
        const list: ARBUser[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            uid: d.id,
            name: data.name || "Unknown",
            municipality: data.municipality || "",
            barangay: data.barangay || "",
          });
        });
        setArbUsers(list);
      },
    );

    const unsubCoops = onSnapshot(collection(db, "cooperatives"), (snap) => {
      const list: CoopRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name,
          municipality: data.municipality,
        });
      });
      setCooperatives(list);
    });

    return () => {
      unsubTrainings();
      unsubAcks();
      unsubARBs();
      unsubCoops();
    };
  }, []);

  const filteredTrainings = useMemo(() => {
    let result = trainings;
    if (statusFilter !== "all")
      result = result.filter((t) => t.status === statusFilter);
    if (searchQuery.trim()) {
      const term = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.purpose.toLowerCase().includes(term),
      );
    }
    return result;
  }, [trainings, statusFilter, searchQuery]);

  const getTrainingAcks = (trainingId: string) =>
    acks.filter((a) => a.trainingId === trainingId);

  const createTraining = async () => {
    if (!formName.trim()) {
      setFormError("Training name is required.");
      return;
    }
    if (!formDate) {
      setFormError("Please select a date.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "trainings"), {
        name: formName.trim(),
        purpose: formPurpose.trim(),
        date: new Date(formDate).toISOString(),
        status: formStatus,
        documentLinks: formLinks.filter((l) => l.trim()),
        assignedTo: formAssignedTo,
        assignedCoopIds: formSelectedCoops,
        assignedUserIds: formSelectedUsers,
        createdAt: new Date().toISOString(),
        createdBy: profile?.name || "Admin",
      });

      // Write pending acknowledgments for assigned users
      for (const uid of formSelectedUsers) {
        const user = arbUsers.find((a) => a.uid === uid);
        const ackId = `${docRef.id}_${uid}`;
        await setDoc(doc(db, "trainingAcknowledgments", ackId), {
          trainingId: docRef.id,
          userId: uid,
          userName: user?.name || "Unknown",
          status: "pending",
        });
      }

      resetForm();
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
      setFormError("Failed to create training.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateTrainingStatus = async (
    id: string,
    status: "ongoing" | "completed",
  ) => {
    try {
      await updateDoc(doc(db, "trainings", id), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTraining = async (training: Training) => {
    if (!confirm(`Delete training "${training.name}"?`)) return;
    try {
      // Clean up acks
      const trainingAcks = getTrainingAcks(training.id);
      await Promise.all(
        trainingAcks.map((a) =>
          deleteDoc(doc(db, "trainingAcknowledgments", a.id)),
        ),
      );
      await deleteDoc(doc(db, "trainings", training.id));
    } catch (err) {
      console.error(err);
    }
  };

  const sendReminder = async (training: Training, userId: string) => {
    try {
      await addDoc(collection(db, "notifications"), {
        recipientId: userId,
        recipientRole: "arb",
        type: "training_reminder",
        title: `Reminder: ${training.name}`,
        message: `Please acknowledge your attendance for "${training.name}" on ${formatDate(training.date)}.`,
        applicationId: null,
        read: false,
        createdAt: new Date().toISOString(),
      });
      alert("Reminder sent!");
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormPurpose("");
    setFormDate("");
    setFormStatus("ongoing");
    setFormLinks([""]);
    setFormAssignedTo("individuals");
    setFormSelectedCoops([]);
    setFormSelectedUsers([]);
    setFormUserSearch("");
    setFormError(null);
  };

  const addLinkField = () => setFormLinks([...formLinks, ""]);
  const updateLink = (i: number, val: string) => {
    const copy = [...formLinks];
    copy[i] = val;
    setFormLinks(copy);
  };
  const removeLink = (i: number) =>
    setFormLinks(formLinks.filter((_, idx) => idx !== i));

  const toggleUserSelection = (uid: string) => {
    setFormSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid],
    );
  };

  const toggleCoopSelection = (coopId: string) => {
    setFormSelectedCoops((prev) =>
      prev.includes(coopId)
        ? prev.filter((c) => c !== coopId)
        : [...prev, coopId],
    );
  };

  const openEdit = (t: Training) => {
    setEditingTraining(t);
    setFormName(t.name);
    setFormPurpose(t.purpose);
    setFormDate(t.date ? new Date(t.date).toISOString().split("T")[0] : "");
    setFormStatus(t.status);
    setFormLinks(t.documentLinks.length > 0 ? t.documentLinks : [""]);
    setFormAssignedTo(t.assignedTo);
    setFormSelectedCoops(t.assignedCoopIds);
    setFormSelectedUsers(t.assignedUserIds);
  };

  const saveEdit = async () => {
    if (!editingTraining || !formName.trim()) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "trainings", editingTraining.id), {
        name: formName.trim(),
        purpose: formPurpose.trim(),
        date: new Date(formDate).toISOString(),
        status: formStatus,
        documentLinks: formLinks.filter((l) => l.trim()),
        assignedTo: formAssignedTo,
        assignedCoopIds: formSelectedCoops,
        assignedUserIds: formSelectedUsers,
      });
      setEditingTraining(null);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const modalFilteredARBs = useMemo(() => {
    if (!formUserSearch.trim()) return arbUsers;
    const term = formUserSearch.trim().toLowerCase();
    return arbUsers.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.municipality.toLowerCase().includes(term),
    );
  }, [arbUsers, formUserSearch]);

  const selectAllVisible = () => {
    const visibleIds = modalFilteredARBs.map((a) => a.uid);
    setFormSelectedUsers((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const deselectAllVisible = () => {
    const visibleIds = new Set(modalFilteredARBs.map((a) => a.uid));
    setFormSelectedUsers((prev) => prev.filter((uid) => !visibleIds.has(uid)));
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Training Administration
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Training Management
            </h1>
          </div>
          <button
            onClick={() => {
              setShowAddModal(true);
              resetForm();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer"
          >
            <Plus size={14} /> New Training
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-6xl">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Total Trainings
                </span>
                <p className="text-2xl font-extrabold text-emerald-900">
                  {trainings.length}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Ongoing
                </span>
                <p className="text-2xl font-extrabold text-amber-600">
                  {trainings.filter((t) => t.status === "ongoing").length}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Pending Acks
                </span>
                <p className="text-2xl font-extrabold text-red-600">
                  {acks.filter((a) => a.status === "pending").length}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search trainings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {(["all", "ongoing", "completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${statusFilter === s ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                >
                  {s === "all"
                    ? "All"
                    : s === "ongoing"
                      ? "Ongoing"
                      : "Completed"}
                </button>
              ))}
            </div>

            {/* Trainings List */}
            {filteredTrainings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <GraduationCap
                  size={32}
                  className="text-slate-300 mx-auto mb-3"
                />
                <h3 className="text-sm font-bold text-slate-500 mb-1">
                  No Trainings Yet
                </h3>
                <p className="text-xs text-slate-400">
                  Create your first training to assign to ARBs or ARBOs.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTrainings.map((t) => {
                  const trainingAcks = getTrainingAcks(t.id);
                  const ackCount = trainingAcks.filter(
                    (a) => a.status === "acknowledged",
                  ).length;
                  const declinedCount = trainingAcks.filter(
                    (a) => a.status === "declined",
                  ).length;
                  const pendingCount = trainingAcks.filter(
                    (a) => a.status === "pending",
                  ).length;
                  const isExpanded = expandedTraining === t.id;
                  return (
                    <div
                      key={t.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      <div
                        onClick={() =>
                          setExpandedTraining(isExpanded ? null : t.id)
                        }
                        className="p-5 flex items-start justify-between cursor-pointer hover:bg-slate-50/50"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${t.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            <GraduationCap size={22} />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "completed" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                {t.status === "completed"
                                  ? "Completed"
                                  : "Ongoing"}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {t.assignedTo === "cooperative"
                                  ? "ARBO"
                                  : "Individuals"}
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm">
                              {t.name}
                            </h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} /> {formatDate(t.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-xs">
                            {ackCount > 0 && (
                              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <CheckCircle2 size={12} />
                                {ackCount}
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="text-amber-600 font-bold flex items-center gap-0.5">
                                <Clock size={12} />
                                {pendingCount}
                              </span>
                            )}
                            {declinedCount > 0 && (
                              <span className="text-red-500 font-bold flex items-center gap-0.5">
                                <XCircle size={12} />
                                {declinedCount}
                              </span>
                            )}
                          </div>
                          <button className="text-slate-400">
                            {isExpanded ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                          <div className="text-xs text-slate-600">
                            <p className="font-bold text-slate-700 mb-1">
                              Purpose:
                            </p>
                            <p>{t.purpose || "No description"}</p>
                          </div>
                          {t.documentLinks.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-700 mb-1">
                                Documents / Links:
                              </p>
                              <div className="space-y-1">
                                {t.documentLinks.map((link, i) => (
                                  <a
                                    key={i}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                                  >
                                    <LinkIcon size={10} /> {link}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Acknowledgment Status */}
                          <div>
                            <p className="text-xs font-bold text-slate-700 mb-2">
                              Acknowledgement Status ({trainingAcks.length}{" "}
                              assigned)
                            </p>
                            {trainingAcks.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                No acknowledgments yet.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {trainingAcks.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-700">
                                        {a.userName}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                          a.status === "acknowledged"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : a.status === "declined"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-amber-100 text-amber-700"
                                        }`}
                                      >
                                        {a.status === "acknowledged"
                                          ? "✓ Attending"
                                          : a.status === "declined"
                                            ? "✗ Declined"
                                            : "Pending"}
                                      </span>
                                      {a.reason && (
                                        <span className="text-slate-400">
                                          — {a.reason}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {a.acknowledgedAt && (
                                        <span className="text-[10px] text-slate-400">
                                          {formatDate(a.acknowledgedAt)}
                                        </span>
                                      )}
                                      {a.status === "pending" && (
                                        <button
                                          onClick={() =>
                                            sendReminder(t, a.userId)
                                          }
                                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                        >
                                          <Send size={10} /> Remind
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => openEdit(t)}
                              className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                updateTrainingStatus(
                                  t.id,
                                  t.status === "ongoing"
                                    ? "completed"
                                    : "ongoing",
                                )
                              }
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer"
                            >
                              Mark{" "}
                              {t.status === "ongoing" ? "Completed" : "Ongoing"}
                            </button>
                            <button
                              onClick={() => deleteTraining(t)}
                              className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg border border-red-200 cursor-pointer ml-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingTraining) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 my-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-sm text-slate-900">
                {editingTraining ? "Edit Training" : "Create Training"}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTraining(null);
                  resetForm();
                }}
                className="text-slate-400 hover:bg-slate-200 p-2 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Training Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Organic Farming Workshop"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the training purpose..."
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as "ongoing" | "completed")
                    }
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Document Links
                </label>
                {formLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 mb-1.5">
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={link}
                      onChange={(e) => updateLink(i, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    {formLinks.length > 1 && (
                      <button
                        onClick={() => removeLink(i)}
                        className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addLinkField}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={10} /> Add Link
                </button>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Assign To
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setFormAssignedTo("individuals")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer ${formAssignedTo === "individuals" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    Individuals
                  </button>
                  <button
                    onClick={() => setFormAssignedTo("cooperative")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border cursor-pointer ${formAssignedTo === "cooperative" ? "bg-emerald-800 text-white border-emerald-800" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    ARBOs
                  </button>
                </div>
                {formAssignedTo === "cooperative" ? (
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
                    {cooperatives.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-xs cursor-pointer py-1 px-2 hover:bg-slate-50 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={formSelectedCoops.includes(c.id)}
                          onChange={() => toggleCoopSelection(c.id)}
                          className="rounded accent-emerald-700"
                        />
                        {c.name} ({c.municipality})
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    {/* Search + selection controls */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Search
                          size={12}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="Search ARBs by name or municipality..."
                          value={formUserSearch}
                          onChange={(e) => setFormUserSearch(e.target.value)}
                          className="block w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[10px] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        onClick={selectAllVisible}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded border border-indigo-200 cursor-pointer whitespace-nowrap"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllVisible}
                        className="text-[9px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        Clear
                      </button>
                    </div>
                    {/* Selected count */}
                    {formSelectedUsers.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {formSelectedUsers.length} selected
                        </span>
                        {formSelectedUsers.slice(0, 5).map((uid) => {
                          const u = arbUsers.find((a) => a.uid === uid);
                          return u ? (
                            <span
                              key={uid}
                              className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full"
                            >
                              {u.name}
                            </span>
                          ) : null;
                        })}
                        {formSelectedUsers.length > 5 && (
                          <span className="text-[9px] text-slate-400">
                            +{formSelectedUsers.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                    {/* ARB checkbox list */}
                    <div className="max-h-44 overflow-y-auto space-y-0.5 border border-slate-200 rounded-xl p-2">
                      {modalFilteredARBs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">
                          {formUserSearch
                            ? "No matching ARBs found."
                            : "No ARBs available."}
                        </p>
                      ) : (
                        modalFilteredARBs.slice(0, 100).map((a) => (
                          <label
                            key={a.uid}
                            className="flex items-center gap-2 text-xs cursor-pointer py-1 px-2 hover:bg-slate-50 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={formSelectedUsers.includes(a.uid)}
                              onChange={() => toggleUserSelection(a.uid)}
                              className="rounded accent-emerald-700"
                            />
                            {a.name}
                            <span className="text-slate-400 text-[10px]">
                              — {a.municipality}
                            </span>
                          </label>
                        ))
                      )}
                      {modalFilteredARBs.length > 100 && (
                        <p className="text-[9px] text-slate-400 text-center py-1">
                          Showing 100 of {modalFilteredARBs.length}. Refine your
                          search.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <XCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTraining(null);
                  resetForm();
                }}
                className="rounded-lg border border-slate-200 bg-white text-slate-700 py-2 px-4 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={editingTraining ? saveEdit : createTraining}
                disabled={submitting}
                className="rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Plus size={14} />
                )}
                {editingTraining ? "Save Changes" : "Create Training"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingManagement;

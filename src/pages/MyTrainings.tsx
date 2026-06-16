import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  onSnapshot,
  orderBy,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { formatDate } from "../utils/formatters";
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  AlertCircle,
} from "lucide-react";

interface Training {
  id: string;
  name: string;
  purpose: string;
  date: string;
  status: "ongoing" | "completed";
  documentLinks: string[];
  assignedTo: string;
  assignedCoopIds: string[];
  assignedUserIds: string[];
  createdAt: string;
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

export const MyTrainings: React.FC = () => {
  const { user, profile } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [acks, setAcks] = useState<TrainingAck[]>([]);
  const [loading, setLoading] = useState(true);

  // Acknowledge modal state
  const [showAckModal, setShowAckModal] = useState<string | null>(null);
  const [ackResponse, setAckResponse] = useState<"acknowledged" | "declined">(
    "acknowledged",
  );
  const [ackReason, setAckReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load trainings assigned to this user
  useEffect(() => {
    if (!user) return;

    let myCoopIds: string[] = [];

    // First, find which coops this user belongs to
    const unsubCoop = onSnapshot(
      query(
        collection(db, "cooperativeMembers"),
        where("userId", "==", user.uid),
      ),
      (snap) => {
        myCoopIds = snap.docs.map((d) => d.data().cooperativeId);
      },
    );

    // Get trainings where user is directly assigned OR via coop
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
          });
        });
        // Show trainings where user is directly assigned OR is member of assigned coop
        setTrainings(
          list.filter(
            (t) =>
              t.assignedUserIds.includes(user.uid) ||
              t.assignedCoopIds.some((cid) => myCoopIds.includes(cid)),
          ),
        );
      },
    );

    const unsubAcks = onSnapshot(
      query(
        collection(db, "trainingAcknowledgments"),
        where("userId", "==", user.uid),
      ),
      (snap) => {
        const list: TrainingAck[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({ id: d.id, ...data } as TrainingAck);
        });
        setAcks(list);
        setLoading(false);
      },
    );

    return () => {
      unsubTrainings();
      unsubAcks();
      unsubCoop();
    };
  }, [user]);

  const getAckForTraining = (trainingId: string) =>
    acks.find((a) => a.trainingId === trainingId);

  const submitAcknowledgment = async () => {
    if (!user || !showAckModal) return;
    setSubmitting(true);
    try {
      const ackId = `${showAckModal}_${user.uid}`;
      await setDoc(doc(db, "trainingAcknowledgments", ackId), {
        trainingId: showAckModal,
        userId: user.uid,
        userName: profile?.name || "Unknown",
        status: ackResponse,
        reason: ackResponse === "declined" ? ackReason.trim() : null,
        acknowledgedAt: new Date().toISOString(),
      });

      // Write notification for admin
      const training = trainings.find((t) => t.id === showAckModal);
      await addDoc(collection(db, "notifications"), {
        recipientRole: "admin",
        recipientId: "admin",
        type: "training_acknowledged",
        title: `Training ${ackResponse === "acknowledged" ? "Accepted" : "Declined"}`,
        message: `${profile?.name || "ARB"} has ${ackResponse === "acknowledged" ? "acknowledged" : "declined"} "${training?.name || "training"}".${ackResponse === "declined" ? ` Reason: ${ackReason.trim()}` : ""}`,
        applicationId: null,
        read: false,
        createdAt: new Date().toISOString(),
      });

      setShowAckModal(null);
      setAckReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const upcomingTrainings = trainings.filter((t) => {
    const d = new Date(t.date);
    const now = new Date();
    return d >= now && t.status === "ongoing";
  });

  const pastTrainings = trainings.filter((t) => {
    const d = new Date(t.date);
    const now = new Date();
    return d < now || t.status === "completed";
  });

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Training & Development
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              My Trainings
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-3xl">
            {/* Upcoming Trainings */}
            {upcomingTrainings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  Upcoming Trainings
                </h2>
                <div className="space-y-3">
                  {upcomingTrainings.map((t) => {
                    const ack = getAckForTraining(t.id);
                    const days = daysUntil(t.date);
                    const urgent =
                      days <= 7 && (!ack || ack.status === "pending");
                    return (
                      <div
                        key={t.id}
                        className={`bg-white rounded-2xl border shadow-sm p-5 ${urgent ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                              <GraduationCap size={22} />
                            </div>
                            <div className="text-left">
                              <h3 className="font-bold text-slate-900 text-sm">
                                {t.name}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {t.purpose}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Calendar size={10} /> {formatDate(t.date)}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                  {t.assignedTo === "cooperative"
                                    ? "ARBO"
                                    : "Individual"}
                                </span>
                                {urgent && (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertCircle size={10} />{" "}
                                    {days <= 0 ? "Today!" : `${days} days away`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            {ack ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                  ack.status === "acknowledged"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : ack.status === "declined"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {ack.status === "acknowledged"
                                  ? "✓ Attending"
                                  : ack.status === "declined"
                                    ? "✗ Declined"
                                    : "Pending"}
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowAckModal(t.id);
                                  setAckResponse("acknowledged");
                                  setAckReason("");
                                }}
                                className="text-[10px] font-bold bg-emerald-800 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-950 transition-colors cursor-pointer"
                              >
                                Respond
                              </button>
                            )}
                          </div>
                        </div>
                        {t.documentLinks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                            {t.documentLinks.map((link, i) => (
                              <a
                                key={i}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800"
                              >
                                <LinkIcon size={10} /> Training Material {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past Trainings */}
            {pastTrainings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-slate-400" />
                  Past Trainings
                </h2>
                <div className="space-y-2">
                  {pastTrainings.map((t) => {
                    return (
                      <div
                        key={t.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                            <GraduationCap size={18} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-slate-700">
                              {t.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatDate(t.date)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === "completed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {t.status === "completed" ? "Completed" : "Past"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {trainings.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <GraduationCap
                  size={32}
                  className="text-slate-300 mx-auto mb-3"
                />
                <h3 className="text-sm font-bold text-slate-500 mb-1">
                  No Trainings Assigned
                </h3>
                <p className="text-xs text-slate-400">
                  You have no trainings assigned yet. Trainings assigned by the
                  admin will appear here.
                </p>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Acknowledge Modal */}
      {showAckModal &&
        (() => {
          const t = trainings.find((tr) => tr.id === showAckModal);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
                <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50">
                  <h3 className="font-bold text-sm text-slate-900">
                    Training Response
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t?.name}</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                      Your Response
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAckResponse("acknowledged")}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5 ${
                          ackResponse === "acknowledged"
                            ? "bg-emerald-800 text-white border-emerald-800"
                            : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        <CheckCircle2 size={14} /> Will Attend
                      </button>
                      <button
                        onClick={() => setAckResponse("declined")}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold border cursor-pointer flex items-center justify-center gap-1.5 ${
                          ackResponse === "declined"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        <XCircle size={14} /> Cannot Attend
                      </button>
                    </div>
                  </div>
                  {ackResponse === "declined" && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Reason
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Please explain why you cannot attend..."
                        value={ackReason}
                        onChange={(e) => setAckReason(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                      />
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    onClick={() => setShowAckModal(null)}
                    className="rounded-lg border border-slate-200 bg-white text-slate-700 py-2 px-4 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitAcknowledgment}
                    disabled={
                      submitting ||
                      (ackResponse === "declined" && !ackReason.trim())
                    }
                    className="rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default MyTrainings;

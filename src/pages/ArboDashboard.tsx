import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { writeAuditLog } from "../utils/audit";
import { broadcastNotification } from "../contexts/NotificationContext";
import {
  FREQUENCY_LABELS,
  LOAN_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  checkLoanHistory,
  generateLoanId,
  type PaymentFrequency,
  type Loan,
  type LoanPayment,
  type LoanIncomeExpense,
  type CooperativeLoanAllocation,
} from "../types/loan";
import {
  Users,
  Building2,
  MapPin,
  TrendingUp,
  GraduationCap,
  FileText,
  AlertCircle,
  CheckCircle2,
  Send,
  XCircle,
  Clock,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
} from "lucide-react";

interface CoopMember {
  id: string;
  cooperativeId: string;
  userId: string;
  userName: string;
  userMunicipality: string;
  userBarangay: string;
  joinedAt: string;
}

interface ArboRecord {
  id: string;
  name: string;
  address: string;
  municipality: string;
  province: string;
  logo: string;
  headId: string;
  headName: string;
  createdAt: string;
}

type TabId = "members" | "trainings" | "grants" | "loans" | "notes";

const TABS: { id: TabId; label: string; icon: React.FC<{ size?: number }> }[] =
  [
    { id: "members", label: "Members", icon: Users },
    { id: "trainings", label: "Trainings", icon: GraduationCap },
    { id: "grants", label: "Grants", icon: TrendingUp },
    { id: "loans", label: "Loans", icon: FileText },
    { id: "notes", label: "Admin Notes", icon: AlertCircle },
  ];

export const ArboDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [arbo, setArbo] = useState<ArboRecord | null>(null);
  const [members, setMembers] = useState<CoopMember[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("members");
  const [loading, setLoading] = useState(true);

  // Load the ARBO this head manages
  useEffect(() => {
    if (!profile) return;

    // Find the ARBO where this user is head
    const unsub = onSnapshot(
      query(collection(db, "cooperatives"), where("headId", "==", profile.uid)),
      (snap) => {
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data();
          setArbo({
            id: doc.id,
            name: data.name,
            address: data.address,
            municipality: data.municipality,
            province: data.province,
            logo: data.logo || "",
            headId: data.headId,
            headName: data.headName,
            createdAt: data.createdAt,
          });
        }
        setLoading(false);
      },
    );

    return () => unsub();
  }, [profile]);

  // Load members of this ARBO
  useEffect(() => {
    if (!arbo) return;

    const unsub = onSnapshot(
      query(
        collection(db, "cooperativeMembers"),
        where("cooperativeId", "==", arbo.id),
      ),
      (snap) => {
        const list: CoopMember[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            cooperativeId: data.cooperativeId,
            userId: data.userId,
            userName: data.userName,
            userMunicipality: data.userMunicipality || "",
            userBarangay: data.userBarangay || "",
            joinedAt: data.joinedAt,
          });
        });
        setMembers(list);
      },
    );

    return () => unsub();
  }, [arbo]);

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
            <p className="text-xs text-slate-500">Loading ARBO dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!arbo) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center max-w-md">
            <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-700 mb-2">
              No ARBO Assigned
            </h2>
            <p className="text-sm text-slate-500">
              You have been designated as an ARBO Head, but no ARBO is currently
              linked to your account. Please contact the DAR Administrator to
              assign your ARBO.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 pt-14 md:pt-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center overflow-hidden">
              {arbo.logo ? (
                <img
                  src={arbo.logo}
                  alt={arbo.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 size={22} className="text-emerald-700" />
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
                ARBO Dashboard
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
                {arbo.name}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin size={10} />
                {arbo.municipality}, {arbo.province}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <Users size={14} className="text-emerald-700" />
            <span className="text-[10px] font-bold text-emerald-800 uppercase">
              {members.length + 1} Participant{members.length + 1 !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-slate-200 px-8 flex gap-1 shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <main className="p-8 max-w-5xl">
          {activeTab === "members" && (
            <MembersTab members={members} arboName={arbo.name} />
          )}
          {activeTab === "trainings" && (
            <TrainingsTab arboId={arbo.id} members={members} />
          )}
          {activeTab === "grants" && (
            <GrantsTab arboId={arbo.id} members={members} />
          )}
          {activeTab === "loans" && (
            <LoansTab
              arboId={arbo.id}
              arboName={arbo.name}
              members={members}
              verifierId={profile?.uid || ""}
              applicantName={profile?.name || arbo.headName}
            />
          )}
          {activeTab === "notes" && <NotesTab arboId={arbo.id} />}
        </main>
      </div>
    </div>
  );
};

/* ───────── Sub-components ───────── */

const MembersTab: React.FC<{ members: CoopMember[]; arboName: string }> = ({
  members,
  arboName,
}) => {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <Users size={32} className="text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-500 mb-1">
          No Members Yet
        </h3>
        <p className="text-xs text-slate-400">
          Members added to {arboName} will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">
          All Members ({members.length})
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {members.map((m) => (
          <div
            key={m.id}
            className="px-6 py-3 flex items-center justify-between hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-xs text-emerald-700 uppercase">
                {m.userName.substring(0, 2)}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">{m.userName}</p>
                <p className="text-xs text-slate-400">
                  {m.userBarangay && `${m.userBarangay}, `}
                  {m.userMunicipality}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">
              Joined {new Date(m.joinedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TrainingsTab: React.FC<{ arboId: string; members: CoopMember[] }> = ({
  arboId,
  members,
}) => {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [acks, setAcks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTraining, setExpandedTraining] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<
    "all" | "acknowledged" | "pending" | "declined"
  >("all");
  const [nudgingAll, setNudgingAll] = useState(false);

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, "trainings"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const memberIds = new Set(members.map((m) => m.userId));
        const assignedIds: string[] = data.assignedUserIds || [];
        const assignedCoops: string[] = data.assignedCoopIds || [];
        if (
          data.assignedTo === "all" ||
          assignedIds.some((id: string) => memberIds.has(id)) ||
          assignedCoops.includes(arboId)
        ) {
          list.push({ id: d.id, ...data });
        }
      });
      setTrainings(list);
    });
    const unsubA = onSnapshot(
      collection(db, "trainingAcknowledgments"),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAcks(list);
        setLoading(false);
      },
    );
    return () => {
      unsubT();
      unsubA();
    };
  }, [members]);

  const getAck = (trainingId: string, userId: string) =>
    acks.find((a) => a.trainingId === trainingId && a.userId === userId);

  const getAckStatus = (
    ack: any,
  ): "pending" | "acknowledged" | "declined" =>
    ack?.status === "acknowledged" || ack?.status === "declined"
      ? ack.status
      : "pending";

  const sendNudge = async (userId: string, trainingName: string) => {
    await addDoc(collection(db, "notifications"), {
      recipientId: userId,
      recipientRole: "arb",
      type: "training_reminder",
      title: `Please Acknowledge: ${trainingName}`,
      message: `Your ARBO head reminds you to acknowledge your attendance for "${trainingName}".`,
      applicationId: null,
      read: false,
      createdAt: new Date().toISOString(),
    });
    alert("Nudge sent!");
  };

  const sendNudgeAll = async (
    pendingMembers: CoopMember[],
    trainingName: string,
  ) => {
    if (pendingMembers.length === 0) return;
    setNudgingAll(true);
    try {
      await Promise.all(
        pendingMembers.map((member) =>
          addDoc(collection(db, "notifications"), {
            recipientId: member.userId,
            recipientRole: "arb",
            type: "training_reminder",
            title: `Please Acknowledge: ${trainingName}`,
            message: `Your ARBO head reminds you to acknowledge your attendance for "${trainingName}".`,
            applicationId: null,
            read: false,
            createdAt: new Date().toISOString(),
          }),
        ),
      );
      alert(`Nudges sent to ${pendingMembers.length} pending member(s).`);
    } catch (error) {
      console.error("Failed to nudge pending training members", error);
    } finally {
      setNudgingAll(false);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading trainings...
      </div>
    );
  if (trainings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <GraduationCap size={32} className="text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-500 mb-1">
          No Trainings Yet
        </h3>
        <p className="text-xs text-slate-400">
          Trainings assigned to your members will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trainings.map((t: any) => {
        const pendingMembers = members.filter((m) => {
          return getAckStatus(getAck(t.id, m.userId)) === "pending";
        });
        const ackMembers = members.filter(
          (m) => getAckStatus(getAck(t.id, m.userId)) === "acknowledged",
        );
        const declinedMembers = members.filter(
          (m) => getAckStatus(getAck(t.id, m.userId)) === "declined",
        );
        const engagementPercent =
          Math.round((ackMembers.length / members.length) * 100) || 0;
        const filteredMembers = members.filter((member) => {
          const status = getAckStatus(getAck(t.id, member.userId));
          const matchesStatus =
            memberStatusFilter === "all" || status === memberStatusFilter;
          const matchesSearch =
            !memberSearch.trim() ||
            member.userName
              .toLowerCase()
              .includes(memberSearch.trim().toLowerCase());
          return matchesStatus && matchesSearch;
        });
        const isExpanded = expandedTraining === t.id;
        return (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Collapsed header */}
            <div
              onClick={() => setExpandedTraining(isExpanded ? null : t.id)}
              className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />{" "}
                    {new Date(t.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {t.status === "completed" ? "Completed" : "Ongoing"}
                  </span>
                  <button className="text-slate-400">
                    {isExpanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {ackMembers.length} Attending
                </span>
                <span className="text-amber-600 font-bold flex items-center gap-1">
                  <Clock size={12} /> {pendingMembers.length} Pending
                </span>
                <span className="text-red-500 font-bold flex items-center gap-1">
                  <XCircle size={12} /> {declinedMembers.length} Declined
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                  <span>
                    {ackMembers.length} of {members.length} members
                    acknowledged ({engagementPercent}%)
                  </span>
                  <span>{engagementPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${engagementPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                {/* Purpose + links */}
                {t.purpose && (
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-700 mb-1">Purpose:</p>
                    <p>{t.purpose}</p>
                  </div>
                )}
                {t.documentLinks?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1">
                      Documents / Links:
                    </p>
                    <div className="space-y-1">
                      {t.documentLinks.map((link: string, i: number) => (
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

                {/* All members with ack status */}
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="mr-auto text-xs font-bold text-slate-700">
                      Acknowledgement Status ({members.length} members)
                    </p>
                    {pendingMembers.length > 0 && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void sendNudgeAll(pendingMembers, t.name);
                        }}
                        disabled={nudgingAll}
                        className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        {nudgingAll ? "Sending..." : "Nudge All Pending"}
                      </button>
                    )}
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="search"
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        placeholder="Search member..."
                        className="block w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[10px] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    {(
                      [
                        ["all", `All (${members.length})`],
                        ["acknowledged", `Attending (${ackMembers.length})`],
                        ["pending", `Pending (${pendingMembers.length})`],
                        ["declined", `Declined (${declinedMembers.length})`],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMemberStatusFilter(value);
                        }}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
                          memberStatusFilter === value
                            ? "border-emerald-800 bg-emerald-800 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {filteredMembers.map((m) => {
                      const ack = getAck(t.id, m.userId);
                      const ackStatus = getAckStatus(ack);
                      return (
                        <div
                          key={m.userId}
                          className="bg-slate-50 rounded-lg px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700">
                                {m.userName}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  ackStatus === "pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : ackStatus === "acknowledged"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {ackStatus === "acknowledged"
                                  ? "✓ Attending"
                                  : ackStatus === "declined"
                                    ? "✗ Declined"
                                    : "Pending"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {ack?.acknowledgedAt && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(
                                    ack.acknowledgedAt,
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              {ackStatus === "pending" && (
                                <button
                                  onClick={() => sendNudge(m.userId, t.name)}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <Send size={10} /> Nudge
                                </button>
                              )}
                            </div>
                          </div>
                          {ack?.status === "declined" && ack?.reason && (
                            <div className="mt-1.5 pt-1.5 border-t border-red-100 text-[10px] text-red-600 italic">
                              Reason: {ack.reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <p className="py-3 text-center text-xs italic text-slate-400">
                        No members match this search or filter.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const GrantsTab: React.FC<{ arboId: string; members: CoopMember[] }> = ({
  arboId: _arboId,
  members,
}) => {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length === 0) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(db, "grants"),
        where("beneficiaryId", "in", memberIds.slice(0, 10)),
      ),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        // Also query remaining if >10 members (Firestore "in" limit)
        setGrants(list);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [members]);

  if (loading)
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading grants...
      </div>
    );
  if (grants.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <TrendingUp size={32} className="text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-500 mb-1">No Grants Yet</h3>
        <p className="text-xs text-slate-400">
          Grants distributed to your members will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400">
          <tr>
            <th className="px-4 py-3 text-left">Member</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Amount</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grants.map((g: any) => (
            <tr key={g.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-xs font-bold text-slate-700">
                {g.beneficiaryName}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    g.type === "cash"
                      ? "bg-emerald-50 text-emerald-700"
                      : g.type === "loan"
                        ? "bg-indigo-50 text-indigo-700"
                        : g.type === "equipment"
                          ? "bg-teal-50 text-teal-700"
                          : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {g.type === "cash"
                    ? "Cash"
                    : g.type === "loan"
                      ? "Loan"
                      : g.type === "equipment"
                        ? "Equipment"
                        : "Materials"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs font-bold text-slate-800">
                {g.type === "cash" || g.type === "loan"
                  ? `₱${g.amount?.toLocaleString()}`
                  : g.type === "equipment"
                    ? `${g.equipmentQuantity ?? 1}x ${g.equipmentItem || ""}`
                    : `${g.amount} ${g.unit || ""}`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    g.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : g.status === "overdue"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {g.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LoansTab: React.FC<{
  arboId: string;
  arboName: string;
  members: CoopMember[];
  verifierId: string;
  applicantName: string;
}> = ({
  arboId,
  arboName,
  members,
  verifierId,
  applicantName,
}) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [incomeExpenses, setIncomeExpenses] = useState<LoanIncomeExpense[]>([]);
  const [borrowerProfiles, setBorrowerProfiles] = useState<
    Record<string, { name: string; contact: string; barangay: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [paymentForDispute, setPaymentForDispute] = useState<LoanPayment | null>(null);
  const [disputeNotes, setDisputeNotes] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [showCoopLoanModal, setShowCoopLoanModal] = useState(false);
  const [resubmittingCoopLoan, setResubmittingCoopLoan] = useState<Loan | null>(
    null,
  );
  const [coopPurpose, setCoopPurpose] = useState("");
  const [coopAmount, setCoopAmount] = useState("");
  const [coopAllocations, setCoopAllocations] = useState<Record<string, string>>({});
  const [coopTerm, setCoopTerm] = useState("12");
  const [coopFrequency, setCoopFrequency] =
    useState<PaymentFrequency>("monthly");
  const [coopResubmissionNotes, setCoopResubmissionNotes] = useState("");
  const [coopError, setCoopError] = useState<string | null>(null);
  const [coopSubmitting, setCoopSubmitting] = useState(false);
  const [loanSearch, setLoanSearch] = useState("");
  const [loanSort, setLoanSort] = useState<
    "newest" | "balance" | "defaults"
  >("newest");
  const [loanPage, setLoanPage] = useState(1);
  const [dossierMemberId, setDossierMemberId] = useState<string | null>(null);

  const loanParticipants: CoopMember[] = [
    {
      id: `head-${verifierId}`,
      cooperativeId: arboId,
      userId: verifierId,
      userName: `${applicantName} (ARBO Head)`,
      userMunicipality: "",
      userBarangay: "",
      joinedAt: "",
    },
    ...members.filter((member) => member.userId !== verifierId),
  ];

  useEffect(() => {
    setCoopAllocations((current) =>
      Object.fromEntries(
        loanParticipants.map((member) => [
          member.userId,
          current[member.userId] ?? "0",
        ]),
      ),
    );
  }, [arboId, applicantName, members, verifierId]);

  useEffect(() => {
    const memberIds = new Set(members.map((member) => member.userId));
    const unsub = onSnapshot(
      collection(db, "loans"),
      (snap) => {
        const list = snap.docs
          .map(
            (d) =>
              ({
                ...d.data(),
                id: String(d.data().id || d.id),
                firestoreId: d.id,
              }) as Loan,
          )
          .filter(
            (loan) =>
              loan.cooperativeId === arboId || memberIds.has(loan.applicantId),
          );
        setLoans(list);
        setLoading(false);
      },
    );
    const unsubPayments = onSnapshot(collection(db, "loanPayments"), (snap) => {
      setPayments(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as LoanPayment,
        ),
      );
    });
    const unsubLedgers = onSnapshot(
      collection(db, "loanIncomeExpenses"),
      (snap) => {
        setIncomeExpenses(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as LoanIncomeExpense,
          ),
        );
      },
    );
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const profiles: Record<
        string,
        { name: string; contact: string; barangay: string }
      > = {};
      snap.forEach((userDoc) => {
        const data = userDoc.data();
        profiles[userDoc.id] = {
          name: data.name || "Unknown",
          contact: data.contact || "",
          barangay: data.barangay || "",
        };
      });
      setBorrowerProfiles(profiles);
    });
    return () => {
      unsub();
      unsubPayments();
      unsubLedgers();
      unsubUsers();
    };
  }, [arboId, members]);

  if (loading)
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Loading loans...
      </div>
    );
  const totalOutstanding = loans.reduce(
    (s, loan) => s + (loan.remainingBalance || 0),
    0,
  );
  const pendingPayments = payments.filter(
    (payment) =>
      loans.some((loan) => loan.id === payment.loanId) &&
      payment.applicantId !== verifierId &&
      (payment.status === "disputed" ||
        ((payment.status === "paid" || payment.status === "partial") &&
          !payment.verifiedAt)),
  );
  const totalCollected = loans.reduce((sum, loan) => sum + loan.totalPaid, 0);
  const memberName = (applicantId: string) =>
    applicantId === verifierId
      ? "You (ARBO Head)"
      : members.find((member) => member.userId === applicantId)?.userName ||
        "Member";
  const activeMemberLoans = loans.filter((loan) => loan.status === "active");
  const totalPortfolioBalance = activeMemberLoans.reduce(
    (sum, loan) => sum + (loan.remainingBalance || 0),
    0,
  );
  const totalPaymentRecords = payments.filter(
    (payment) =>
      loans.some((loan) => loan.id === payment.loanId) &&
      !payment.isEarlyRepayment,
  ).length;
  const totalOnTimePayments = loans.reduce(
    (sum, loan) => sum + (loan.onTimePayments || 0),
    0,
  );
  const onTimeRate = totalPaymentRecords
    ? Math.round((totalOnTimePayments / totalPaymentRecords) * 100)
    : 0;
  const delinquentPayments = payments.filter(
    (payment) =>
      loans.some((loan) => loan.id === payment.loanId) &&
      (payment.status === "overdue" ||
        loans.find((loan) => loan.id === payment.loanId)?.status === "defaulted"),
  );
  const delinquentLoanIds = new Set(
    delinquentPayments.map((payment) => payment.loanId),
  );
  const delinquentAmount = delinquentPayments.reduce(
    (sum, payment) =>
      sum + Math.max(0, (payment.amountDue || 0) - (payment.amountPaid || 0)),
    0,
  );
  const sortedMemberLoans = useMemo(() => {
    const term = loanSearch.trim().toLowerCase();
    return loans
      .filter((loan) => {
        if (!term) return true;
        return (
          memberName(loan.applicantId).toLowerCase().includes(term) ||
          loan.id.toLowerCase().includes(term) ||
          (loan.cooperativeName || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (loanSort === "balance") {
          return (b.remainingBalance || 0) - (a.remainingBalance || 0);
        }
        if (loanSort === "defaults") {
          return (b.defaultedPayments || 0) - (a.defaultedPayments || 0);
        }
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
  }, [loans, loanSearch, loanSort, members, verifierId]);
  const loanPageSize = 10;
  const loanTotalPages = Math.max(
    1,
    Math.ceil(sortedMemberLoans.length / loanPageSize),
  );
  const visibleMemberLoans = sortedMemberLoans.slice(
    (loanPage - 1) * loanPageSize,
    loanPage * loanPageSize,
  );
  const dossierLoans = dossierMemberId
    ? loans.filter(
        (loan) =>
          (loan.applicantType === "individual" &&
            loan.applicantId === dossierMemberId) ||
          (loan.applicantType === "cooperative" &&
            loan.memberAllocations?.some(
              (allocation) => allocation.memberId === dossierMemberId,
            )),
      )
    : [];
  const dossierLoanIds = new Set(dossierLoans.map((loan) => loan.id));
  const dossierMember = dossierMemberId
    ? members.find((member) => member.userId === dossierMemberId)
    : null;
  const dossierProfile = dossierMemberId
    ? borrowerProfiles[dossierMemberId]
    : undefined;
  const dossierPayments = dossierMemberId
    ? payments.filter(
        (payment) =>
          payment.memberId === dossierMemberId ||
          (payment.applicantId === dossierMemberId &&
            (!payment.memberId || payment.memberId === dossierMemberId)),
      )
    : [];
  const dossierLedger = dossierMemberId
    ? incomeExpenses.filter((entry) => entry.userId === dossierMemberId)
    : [];
  const dossierTotalBorrowed = dossierLoans.reduce((sum, loan) => {
    if (loan.applicantType === "cooperative") {
      return (
        sum +
        (loan.memberAllocations?.find(
          (allocation) => allocation.memberId === dossierMemberId,
        )?.amount || 0)
      );
    }
    return sum + (loan.principalAmount || 0);
  }, 0);
  const dossierTotalRepaid = dossierPayments.reduce(
    (sum, payment) =>
      sum +
      (["paid", "partial"].includes(payment.status)
        ? payment.amountPaid || 0
        : 0),
    0,
  );
  const dossierIncome = dossierLedger
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const dossierExpenses = dossierLedger
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const dossierDefaults = dossierLoans.reduce(
    (sum, loan) => sum + (loan.defaultedPayments || 0),
    0,
  );
  const currentAllocationTotal = loanParticipants.reduce(
    (sum, member) => sum + Number(coopAllocations[member.userId] || 0),
    0,
  );
  const openCooperativeLoanModal = () => {
    setResubmittingCoopLoan(null);
    setCoopPurpose("");
    setCoopAmount("");
    setCoopTerm("12");
    setCoopFrequency("monthly");
    setCoopResubmissionNotes("");
    setCoopError(null);
    setShowCoopLoanModal(true);
  };
  const openCooperativeResubmission = (loan: Loan) => {
    setResubmittingCoopLoan(loan);
    setCoopPurpose(loan.purpose);
    setCoopAmount(String(loan.principalAmount));
    setCoopTerm(String(loan.termMonths));
    setCoopFrequency(loan.paymentFrequency);
    setCoopResubmissionNotes("");
    setCoopAllocations(
      Object.fromEntries(
        loanParticipants.map((participant) => [
          participant.userId,
          String(
            loan.memberAllocations?.find(
              (allocation) => allocation.memberId === participant.userId,
            )?.amount || 0,
          ),
        ]),
      ),
    );
    setCoopError(null);
    setShowCoopLoanModal(true);
  };
  const closeCooperativeLoanModal = () => {
    setShowCoopLoanModal(false);
    setResubmittingCoopLoan(null);
    setCoopResubmissionNotes("");
  };
  const handleCooperativeLoanSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const amount = Number(coopAmount);
    const term = Number(coopTerm);
    const memberAllocations: CooperativeLoanAllocation[] = loanParticipants.map(
      (member) => ({
        memberId: member.userId,
        memberName: member.userName,
        amount: Number(coopAllocations[member.userId] || 0),
      }),
    );
    const allocatedTotal = memberAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    if (
      !coopPurpose.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(term) ||
      term < 1
    ) {
      setCoopError("Enter a purpose, valid amount, and term.");
      return;
    }
    if (resubmittingCoopLoan && !coopResubmissionNotes.trim()) {
      setCoopError("Add notes explaining how you addressed the rejection.");
      return;
    }
    if (
      memberAllocations.some(
        (allocation) =>
          !Number.isFinite(allocation.amount) || allocation.amount < 0,
      )
    ) {
      setCoopError("Each member allocation must be zero or greater.");
      return;
    }
    if (Math.abs(allocatedTotal - amount) > 0.01) {
      setCoopError(
        `Member allocations must equal ${amount.toLocaleString(
          "en-PH",
          { minimumFractionDigits: 2 },
        )}. Current total: ${allocatedTotal.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
        })}.`,
      );
      return;
    }
    setCoopSubmitting(true);
    setCoopError(null);
    try {
      const history = checkLoanHistory(
        loans.filter((loan) => loan.applicantId === verifierId),
      );
      const now = new Date().toISOString();
      const cooperativeLoanId =
        resubmittingCoopLoan?.id || generateLoanId();
      if (resubmittingCoopLoan) {
        await updateDoc(
          doc(
            db,
            "loans",
            resubmittingCoopLoan.firestoreId || resubmittingCoopLoan.id,
          ),
          {
            principalAmount: amount,
            termMonths: term,
            paymentFrequency: coopFrequency,
            purpose: coopPurpose.trim(),
            memberAllocations,
            totalInterest: 0,
            totalRepayment: amount,
            installmentAmount: 0,
            numberOfPayments: 0,
            status: resubmittingCoopLoan.hasHistoryFlag
              ? "needs_review"
              : "pending_approval",
            rejectedReason: null,
            previousRejectedReason:
              resubmittingCoopLoan.rejectedReason ||
              resubmittingCoopLoan.previousRejectedReason ||
              null,
            resubmissionNotes: coopResubmissionNotes.trim(),
            resubmittedAt: now,
            notes: coopResubmissionNotes.trim(),
            updatedAt: now,
          },
        );
      } else {
        await addDoc(collection(db, "loans"), {
          id: cooperativeLoanId,
          applicantId: verifierId,
          applicantName,
          applicantType: "cooperative",
          cooperativeId: arboId,
          cooperativeName: arboName,
          memberAllocations,
          principalAmount: amount,
          interestRate: 0,
          termMonths: term,
          paymentFrequency: coopFrequency,
          purpose: coopPurpose.trim(),
          totalInterest: 0,
          totalRepayment: amount,
          installmentAmount: 0,
          numberOfPayments: 0,
          status: history.hasDefaults ? "needs_review" : "pending_approval",
          accountStatus: "open",
          totalPaid: 0,
          remainingBalance: 0,
          defaultedPayments: history.totalDefaultedPayments,
          onTimePayments: 0,
          nextPaymentDue: "",
          hasHistoryFlag: history.hasDefaults,
          historyNotes: history.historyNotes,
          notes: "",
          createdAt: now,
          createdBy: verifierId,
          updatedAt: now,
        });
      }
      await writeAuditLog({
        actor: { uid: verifierId, name: applicantName, role: "arbo_head" },
        action: resubmittingCoopLoan
          ? "cooperative_loan_resubmitted"
          : "cooperative_loan_submitted",
        entityType: "loan",
        entityId: cooperativeLoanId,
        oldStatus: resubmittingCoopLoan?.status || null,
        newStatus: history.hasDefaults ? "needs_review" : "pending_approval",
        notes: resubmittingCoopLoan
          ? `${applicantName} resubmitted cooperative loan ${cooperativeLoanId}. Notes: ${coopResubmissionNotes.trim()}`
          : `${applicantName} submitted cooperative loan ${cooperativeLoanId} for ${arboName}.`,
      });
      await broadcastNotification(
        "admin",
        "loan_submitted",
        resubmittingCoopLoan
          ? "Cooperative loan resubmitted"
          : "New cooperative loan application",
        resubmittingCoopLoan
          ? `${applicantName} resubmitted cooperative loan ${resubmittingCoopLoan.id}. Notes: ${coopResubmissionNotes.trim()}`
          : `${applicantName} submitted a ${amount.toLocaleString(
              "en-PH",
            )} cooperative loan for ${arboName}.`,
      );
      closeCooperativeLoanModal();
      setCoopPurpose("");
      setCoopAmount("");
      setCoopTerm("12");
      setCoopAllocations(
        Object.fromEntries(
          loanParticipants.map((member) => [member.userId, "0"]),
        ),
      );
    } catch (error) {
      console.error("Failed to submit cooperative loan:", error);
      setCoopError("Unable to submit the cooperative loan application.");
    } finally {
      setCoopSubmitting(false);
    }
  };
  const verifyPayment = async (payment: LoanPayment, disputed: boolean) => {
    if (payment.applicantId === verifierId) return;
    const loan = loans.find((item) => item.id === payment.loanId);
    if (!loan) return;
    const fullyPaid = payment.amountPaid >= payment.amountDue;
    const verifiedAt = new Date().toISOString();
    await updateDoc(doc(db, "loanPayments", payment.id), {
      status: disputed ? "disputed" : fullyPaid ? "paid" : "partial",
      verifiedBy: verifierId,
      verifiedByName: "ARBO Head",
      verifiedAt,
    });
    await writeAuditLog({
      actor: { uid: verifierId, name: applicantName, role: "arbo_head" },
      action: disputed
        ? "cooperative_payment_disputed"
        : "cooperative_payment_verified",
      entityType: "loan_payment",
      entityId: payment.id,
      applicationId: loan.id,
      oldStatus: payment.status,
      newStatus: disputed ? "disputed" : fullyPaid ? "paid" : "partial",
      notes: `ARBO Head reviewed payment ${payment.paymentNumber} for loan ${loan.id}.`,
    });
    if (!disputed && payment.isEarlyRepayment && fullyPaid) {
      await Promise.all(
        payments
          .filter(
            (candidate) =>
              candidate.loanId === loan.id &&
              candidate.id !== payment.id &&
              candidate.memberId === payment.memberId &&
              ["upcoming", "overdue", "disputed"].includes(candidate.status),
          )
          .map((candidate) =>
            updateDoc(doc(db, "loanPayments", candidate.id), {
              status: "paid",
              amountPaid: candidate.amountDue,
              paidAt: verifiedAt,
              verifiedBy: verifierId,
              verifiedByName: "ARBO Head",
              verifiedAt,
            }),
          ),
      );
    }
    if (!disputed && !payment.verifiedAt) {
      const nextPayment = payments
        .filter(
          (candidate) =>
            candidate.loanId === loan.id &&
            candidate.id !== payment.id &&
            candidate.status === "upcoming" &&
            (!payment.isEarlyRepayment ||
              !fullyPaid ||
              candidate.memberId !== payment.memberId),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const remainingBalance = Math.max(
        0,
        (loan.remainingBalance || loan.totalRepayment) - payment.amountPaid,
      );
      await updateDoc(doc(db, "loans", loan.firestoreId || loan.id), {
        totalPaid: (loan.totalPaid || 0) + payment.amountPaid,
        remainingBalance,
        onTimePayments:
          (loan.onTimePayments || 0) +
          (fullyPaid && Date.now() <= new Date(payment.dueDate).getTime()
            ? 1
            : 0),
        nextPaymentDue: fullyPaid ? nextPayment?.dueDate || "" : payment.dueDate,
        ...(remainingBalance <= 0
          ? { status: "completed", accountStatus: "closed" }
          : {}),
        updatedAt: verifiedAt,
      });
    }
  };

  const disputePayment = async () => {
    if (!paymentForDispute || !disputeNotes.trim()) {
      setDisputeError("Add notes explaining why this payment is disputed.");
      return;
    }
    try {
      const disputedAt = new Date().toISOString();
      await updateDoc(doc(db, "loanPayments", paymentForDispute.id), {
        status: "disputed",
        disputeReason: disputeNotes.trim(),
        lastDisputeReason: disputeNotes.trim(),
        disputedAt,
        disputedBy: verifierId,
        verifiedBy: null,
        verifiedByName: null,
        verifiedAt: null,
      });
      await writeAuditLog({
        actor: { uid: verifierId, name: applicantName, role: "arbo_head" },
        action: "cooperative_payment_disputed",
        entityType: "loan_payment",
        entityId: paymentForDispute.id,
        applicationId: paymentForDispute.loanId,
        oldStatus: paymentForDispute.status,
        newStatus: "disputed",
        notes: `ARBO Head disputed payment ${paymentForDispute.paymentNumber}: ${disputeNotes.trim()}`,
      });
      setPaymentForDispute(null);
      setDisputeNotes("");
      setDisputeError(null);
    } catch (error) {
      console.error("Failed to dispute member payment:", error);
      setDisputeError("Unable to dispute this payment.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Cooperative loan portfolio and member payment receipts.
        </p>
        <button
          onClick={openCooperativeLoanModal}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
        >
          Apply Cooperative Loan
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-indigo-900">
            {loans.length}
          </p>
          <p className="text-[9px] text-slate-400 uppercase">Total Loans</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-red-700">
            ₱{totalOutstanding.toLocaleString()}
          </p>
          <p className="text-[9px] text-slate-400 uppercase">Outstanding</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-emerald-700">
            {loans.filter((loan) => loan.status === "active").length}
          </p>
          <p className="text-[9px] text-slate-400 uppercase">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-emerald-700">
            ₱{totalCollected.toLocaleString()}
          </p>
          <p className="text-[9px] text-slate-400 uppercase">Collected</p>
        </div>
      </div>
      <div className="mb-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">
              Cooperative Financial Health
            </p>
            <p className="mt-1 text-xs text-slate-500">
              A quick view of active member loan performance.
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700 shadow-sm">
            {onTimeRate}% on-time
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400">
              Active Member Loans
            </p>
            <p className="mt-1 text-xl font-extrabold text-indigo-900">
              {activeMemberLoans.length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400">
              Portfolio Balance
            </p>
            <p className="mt-1 text-xl font-extrabold text-indigo-900">
              ₱{totalPortfolioBalance.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400">
              Payment Records
            </p>
            <p className="mt-1 text-xl font-extrabold text-emerald-700">
              {totalPaymentRecords}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-[9px] font-bold uppercase text-slate-400">
              Delinquent Amount
            </p>
            <p className="mt-1 text-xl font-extrabold text-red-700">
              ₱{delinquentAmount.toLocaleString()}
            </p>
            <p className="text-[10px] text-red-600">
              {delinquentLoanIds.size} loan(s)
            </p>
          </div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={loanSearch}
            onChange={(event) => {
              setLoanSearch(event.target.value);
              setLoanPage(1);
            }}
            placeholder="Search member, loan ID, or cooperative..."
            className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={loanSort}
          onChange={(event) => {
            setLoanSort(
              event.target.value as "newest" | "balance" | "defaults",
            );
            setLoanPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
        >
          <option value="newest">Newest First</option>
          <option value="balance">Highest Remaining Balance</option>
          <option value="defaults">Most Defaults</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Interest</th>
              <th className="px-4 py-3 text-left">Remaining</th>
              <th className="px-4 py-3 text-left">Next Due</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleMemberLoans.map((loan) => {
              const loanPayments = payments
                .filter((payment) => payment.loanId === loan.id)
                .sort((a, b) => a.paymentNumber - b.paymentNumber);
              const expanded = expandedLoanId === loan.id;
              return (
                <React.Fragment key={loan.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">
                      <button
                        onClick={() => setDossierMemberId(loan.applicantId)}
                        className="text-left text-indigo-700 hover:underline"
                      >
                        {memberName(loan.applicantId)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-800">
                      ₱{loan.principalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {loan.interestRate}% · {loan.termMonths}mo
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-indigo-700">
                      ₱{loan.remainingBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {loan.nextPaymentDue
                        ? new Date(loan.nextPaymentDue).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${LOAN_STATUS_CONFIG[loan.status].bgColor}`}>
                        {LOAN_STATUS_CONFIG[loan.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setExpandedLoanId(expanded ? null : loan.id)} className="text-slate-500">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 p-3">
                        {loan.status === "rejected" && (
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                            <div>
                              <p className="font-bold">Cooperative loan rejected</p>
                              <p className="mt-1">
                                {loan.rejectedReason ||
                                  "The administrator requested changes before this loan can be reviewed again."}
                              </p>
                            </div>
                            <button
                              onClick={() => openCooperativeResubmission(loan)}
                              className="rounded-lg bg-red-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-red-800"
                            >
                              Resubmit with Notes
                            </button>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-[9px] uppercase text-slate-400"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Due</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">Status</th><th className="p-2"></th></tr></thead>
                            <tbody className="divide-y divide-slate-200">
                              {loanPayments.map((payment) => (
                                <tr key={payment.id}><td className="p-2">{payment.paymentNumber}</td><td className="p-2">{new Date(payment.dueDate).toLocaleDateString()}</td><td className="p-2">₱{payment.amountDue.toLocaleString()}</td><td className="p-2">{payment.status}{payment.applicantId === verifierId && !payment.verifiedAt && <span className="ml-2 text-[10px] font-semibold text-slate-500">Admin verification required</span>}</td><td className="p-2 text-right">{payment.receiptImage && <button onClick={() => setReceiptPreview(payment.receiptImage || null)} className="text-emerald-700 underline">View receipt</button>}</td></tr>
                              ))}
                              {loanPayments.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">No payment history.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                        {loan.memberAllocations &&
                          loan.memberAllocations.length > 0 && (
                            <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                                Member allocation
                              </p>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {loan.memberAllocations.map((allocation) => (
                                  <div
                                    key={allocation.memberId}
                                    className="flex items-center justify-between gap-3 text-xs text-slate-600"
                                  >
                                    <span>{allocation.memberName}</span>
                                    <span
                                      className={`font-bold ${
                                        allocation.amount === 0
                                          ? "text-slate-400"
                                          : "text-slate-800"
                                      }`}
                                    >
                                      ₱{allocation.amount.toLocaleString(
                                        "en-PH",
                                        { minimumFractionDigits: 2 },
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {sortedMemberLoans.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  {loanSearch
                    ? "No loans match your search."
                    : "No cooperative loans yet."}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        {sortedMemberLoans.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] text-slate-500">
              Page {Math.min(loanPage, loanTotalPages)} of {loanTotalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setLoanPage((page) => Math.max(1, page - 1))}
                disabled={loanPage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setLoanPage((page) => Math.min(loanTotalPages, page + 1))
                }
                disabled={loanPage >= loanTotalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {dossierMemberId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setDossierMemberId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 bg-indigo-50 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                  Member Financial Dossier
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {dossierProfile?.name ||
                    dossierMember?.userName ||
                    "Member"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {dossierProfile?.contact || "Contact not available"} ·{" "}
                  {dossierProfile?.barangay ||
                    dossierMember?.userBarangay ||
                    "Barangay not available"}
                </p>
              </div>
              <button
                onClick={() => setDossierMemberId(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-400">
                    Lifetime Borrowed
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-indigo-900">
                    ₱{dossierTotalBorrowed.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-400">
                    Repaid
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700">
                    ₱{dossierTotalRepaid.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-400">
                    Defaults
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-red-700">
                    {dossierDefaults}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-bold uppercase text-slate-400">
                    Ledger Net
                  </p>
                  <p
                    className={`mt-1 text-lg font-extrabold ${
                      dossierIncome - dossierExpenses >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    ₱{(dossierIncome - dossierExpenses).toLocaleString()}
                  </p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Loans
                </h3>
                <div className="space-y-2">
                  {dossierLoans.length === 0 ? (
                    <p className="text-xs italic text-slate-400">
                      No loans found for this member.
                    </p>
                  ) : (
                    dossierLoans.map((loan) => {
                      const allocation =
                        loan.memberAllocations?.find(
                          (item) => item.memberId === dossierMemberId,
                        )?.amount || 0;
                      return (
                        <div
                          key={loan.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {loan.id}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {loan.applicantType === "cooperative"
                                ? `Cooperative allocation: ₱${allocation.toLocaleString()}`
                                : loan.purpose || "Individual loan"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-indigo-700">
                              ₱{loan.remainingBalance.toLocaleString()} remaining
                            </p>
                            <span
                              className={`text-[10px] font-bold ${LOAN_STATUS_CONFIG[loan.status].color}`}
                            >
                              {LOAN_STATUS_CONFIG[loan.status].label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Payment History
                </h3>
                <div className="space-y-2">
                  {dossierPayments.filter((payment) =>
                    dossierLoanIds.has(payment.loanId),
                  ).length === 0 ? (
                    <p className="text-xs italic text-slate-400">
                      No payment history found.
                    </p>
                  ) : (
                    dossierPayments
                      .filter((payment) => dossierLoanIds.has(payment.loanId))
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 20)
                      .map((payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs"
                        >
                          <span>
                            {payment.loanId} · Payment #{payment.paymentNumber}
                          </span>
                          <span className="font-bold">
                            ₱{payment.amountPaid.toLocaleString()} ·{" "}
                            {payment.status}
                            {payment.receiptImage && (
                              <button
                                onClick={() =>
                                  setReceiptPreview(payment.receiptImage || null)
                                }
                                className="ml-2 text-indigo-700 underline"
                              >
                                Receipt
                              </button>
                            )}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                  Income vs Expenses
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold text-emerald-700">
                      Income
                    </p>
                    <p className="text-sm font-extrabold text-emerald-800">
                      ₱{dossierIncome.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-3">
                    <p className="text-[10px] font-bold text-slate-600">
                      Expenses
                    </p>
                    <p className="text-sm font-extrabold text-slate-800">
                      ₱{dossierExpenses.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3">
                    <p className="text-[10px] font-bold text-indigo-700">
                      Net Profit
                    </p>
                    <p className="text-sm font-extrabold text-indigo-800">
                      ₱{(dossierIncome - dossierExpenses).toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {pendingPayments.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-800">
              Payment Verification
            </h3>
            <p className="text-xs text-slate-500">
              Review member-submitted receipts before confirming them. Your own
              ARBO Head payments are excluded and require admin verification.
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[9px] uppercase text-slate-400">
              <tr>
                <th className="p-3 text-left">Member</th>
                <th className="p-3 text-left">Loan</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingPayments.map((payment) => {
                const paymentStatus = PAYMENT_STATUS_CONFIG[payment.status];
                return (
                  <tr key={payment.id}>
                    <td className="p-3">{memberName(payment.applicantId)}</td>
                    <td className="p-3 font-bold">{payment.loanId}</td>
                    <td className="p-3">₱{payment.amountPaid.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${paymentStatus.bgColor} ${paymentStatus.color}`}>
                        {paymentStatus.label}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {payment.receiptImage && (
                        <button onClick={() => setReceiptPreview(payment.receiptImage || null)} className="mr-2 text-emerald-700 underline">Receipt</button>
                      )}
                      {payment.applicantId === verifierId ? (
                        <span className="text-[10px] font-semibold text-slate-500">
                          Admin verification required
                        </span>
                      ) : (
                        <>
                          {(payment.status === "paid" ||
                            payment.status === "partial") && (
                            <button onClick={() => void verifyPayment(payment, false)} className="mr-1 rounded bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Verify</button>
                          )}
                          <button onClick={() => { setPaymentForDispute(payment); setDisputeNotes(""); setDisputeError(null); }} className="rounded bg-orange-600 px-2 py-1 text-[10px] font-bold text-white">Dispute</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paymentForDispute && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" onClick={() => setPaymentForDispute(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Dispute payment</h3>
              <button onClick={() => setPaymentForDispute(null)} className="text-slate-400"><XCircle size={18} /></button>
            </div>
            <p className="mb-3 text-xs text-slate-500">Explain what the member needs to correct, such as a blurred or incorrect receipt.</p>
            <textarea value={disputeNotes} onChange={(event) => setDisputeNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Dispute reason" />
            {disputeError && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{disputeError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPaymentForDispute(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button onClick={() => void disputePayment()} className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white">Save dispute</button>
            </div>
          </div>
        </div>
      )}
      {receiptPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4" onClick={() => setReceiptPreview(null)}>
          <div className="max-h-[90vh] max-w-3xl rounded-xl bg-white p-3" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex justify-end"><button onClick={() => setReceiptPreview(null)}><XCircle size={18} /></button></div>
            <img src={receiptPreview} alt="Payment receipt" className="max-h-[80vh] max-w-full object-contain" />
          </div>
        </div>
      )}
      {showCoopLoanModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                  Cooperative Financing
                </p>
                <h2 className="font-bold text-slate-900">
                  {resubmittingCoopLoan
                    ? "Resubmit Cooperative Loan"
                    : "Apply for a Cooperative Loan"}
                </h2>
              </div>
              <button
                onClick={closeCooperativeLoanModal}
                className="text-slate-400"
              >
                <XCircle size={18} />
              </button>
            </div>
            <form
              onSubmit={handleCooperativeLoanSubmit}
              className="space-y-4 p-5"
            >
              <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                {resubmittingCoopLoan
                  ? "Update this cooperative application and explain how you addressed the administrator's rejection."
                  : `This application is for ${arboName}. It is separate from your personal loans in the My Loans sidebar.`}
              </p>
              {resubmittingCoopLoan?.rejectedReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-bold">Administrator's rejection reason</p>
                  <p className="mt-1">{resubmittingCoopLoan.rejectedReason}</p>
                </div>
              )}
              <label className="block text-xs font-bold text-slate-600">
                Purpose
                <textarea
                  value={coopPurpose}
                  onChange={(event) => setCoopPurpose(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="What will the cooperative loan support?"
                />
              </label>
              {resubmittingCoopLoan && (
                <label className="block text-xs font-bold text-slate-600">
                  Resubmission notes (required)
                  <textarea
                    value={coopResubmissionNotes}
                    onChange={(event) =>
                      setCoopResubmissionNotes(event.target.value)
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Explain what you changed or corrected."
                  />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-600">
                  Amount
                  <input
                    type="number"
                    min="1"
                    value={coopAmount}
                    onChange={(event) => setCoopAmount(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-600">
                  Term (months)
                  <input
                    type="number"
                    min="1"
                    value={coopTerm}
                    onChange={(event) => setCoopTerm(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Split amount by member
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Enter each member's share. Use 0 when a member does not
                      want a portion. The total must equal the loan amount.
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap text-xs font-bold ${
                      Math.abs(currentAllocationTotal - Number(coopAmount || 0)) <=
                      0.01
                        ? "text-emerald-700"
                        : "text-orange-700"
                    }`}
                  >
                    ₱{currentAllocationTotal.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {loanParticipants.map((member) => (
                    <label
                      key={member.userId}
                      className="grid grid-cols-[1fr_9rem] items-center gap-3 text-xs font-semibold text-slate-600"
                    >
                      <span>{member.userName}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={coopAllocations[member.userId] ?? "0"}
                        onChange={(event) =>
                          setCoopAllocations((current) => ({
                            ...current,
                            [member.userId]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-normal text-slate-900"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-bold text-slate-600">
                Payment frequency
                <select
                  value={coopFrequency}
                  onChange={(event) =>
                    setCoopFrequency(event.target.value as PaymentFrequency)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {coopError && (
                <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {coopError}
                </p>
              )}
              <button
                disabled={coopSubmitting}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {coopSubmitting
                  ? "Submitting..."
                  : resubmittingCoopLoan
                    ? "Resubmit Cooperative Loan"
                    : "Submit Cooperative Loan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const NotesTab: React.FC<{ arboId: string }> = ({ arboId }) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "loans"), where("cooperativeId", "==", arboId)),
      (snap) => {
        setLoans(
          snap.docs
            .map(
              (item) =>
                ({
                  ...item.data(),
                  id: String(item.data().id || item.id),
                  firestoreId: item.id,
                }) as Loan,
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load cooperative loan notes:", error);
        setLoading(false);
      },
    );
  }, [arboId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
        Loading cooperative loan notes...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-bold text-amber-900">Cooperative loan notes</h2>
        <p className="mt-1 text-xs text-amber-800">
          Administrator approval notes, rejection reasons, and resubmission
          notes for this ARBO's cooperative loans are collected here.
        </p>
      </div>
      {loans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-500">
            No cooperative loan notes yet
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Notes will appear after an administrator reviews a cooperative
            loan.
          </p>
        </div>
      ) : (
        loans.map((loan) => {
          const status = LOAN_STATUS_CONFIG[loan.status];
          return (
            <article
              key={loan.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-indigo-800">{loan.id}</p>
                  <h3 className="mt-1 font-bold text-slate-900">
                    {loan.purpose}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Updated {new Date(loan.updatedAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.bgColor} ${status.color}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                {loan.rejectedReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                    <p className="font-bold">Administrator rejection reason</p>
                    <p className="mt-1">{loan.rejectedReason}</p>
                  </div>
                )}
                {loan.previousRejectedReason &&
                  loan.previousRejectedReason !== loan.rejectedReason && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-800">
                      <p className="font-bold">Previous rejection reason</p>
                      <p className="mt-1">{loan.previousRejectedReason}</p>
                    </div>
                  )}
                {loan.resubmissionNotes && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800">
                    <p className="font-bold">Resubmission notes</p>
                    <p className="mt-1">{loan.resubmissionNotes}</p>
                  </div>
                )}
                {loan.notes && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    <p className="font-bold">Administrator notes</p>
                    <p className="mt-1">{loan.notes}</p>
                  </div>
                )}
                {!loan.rejectedReason &&
                  !loan.previousRejectedReason &&
                  !loan.resubmissionNotes &&
                  !loan.notes && (
                    <p className="text-slate-400">
                      No written notes have been added for this loan.
                    </p>
                  )}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
};

export default ArboDashboard;

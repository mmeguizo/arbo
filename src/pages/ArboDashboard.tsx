import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
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

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
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
              {members.length} Member{members.length !== 1 ? "s" : ""}
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
            <LoansTab arboId={arbo.id} members={members} />
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

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, "trainings"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // Show trainings assigned to this ARBO's members
        const memberIds = new Set(members.map((m) => m.userId));
        const assignedIds = data.assignedUserIds || [];
        if (assignedIds.some((id: string) => memberIds.has(id))) {
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
          const ack = getAck(t.id, m.userId);
          return !ack || ack.status === "pending";
        });
        const ackMembers = members.filter(
          (m) => getAck(t.id, m.userId)?.status === "acknowledged",
        );
        const declinedMembers = members.filter(
          (m) => getAck(t.id, m.userId)?.status === "declined",
        );
        return (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Calendar size={10} /> {new Date(t.date).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
              >
                {t.status === "completed" ? "Completed" : "Ongoing"}
              </span>
            </div>
            <div className="flex gap-3 text-xs mb-3">
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
            {pendingMembers.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Not Yet Acknowledged
                </p>
                <div className="space-y-1">
                  {pendingMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between text-xs bg-amber-50 rounded-lg px-3 py-1.5"
                    >
                      <span className="font-bold text-slate-700">
                        {m.userName}
                      </span>
                      <button
                        onClick={() => sendNudge(m.userId, t.name)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Send size={10} /> Nudge
                      </button>
                    </div>
                  ))}
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
  arboId,
  members,
}) => {
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length === 0) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "grants"), where("beneficiaryId", "in", memberIds.slice(0, 10))),
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

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading grants...</div>;
  if (grants.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <TrendingUp size={32} className="text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-500 mb-1">No Grants Yet</h3>
        <p className="text-xs text-slate-400">Grants distributed to your members will appear here.</p>
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
              <td className="px-4 py-3 text-xs font-bold text-slate-700">{g.beneficiaryName}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  g.type === "cash" ? "bg-emerald-50 text-emerald-700" :
                  g.type === "loan" ? "bg-indigo-50 text-indigo-700" :
                  g.type === "equipment" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {g.type === "cash" ? "Cash" : g.type === "loan" ? "Loan" : g.type === "equipment" ? "Equipment" : "Materials"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs font-bold text-slate-800">
                {g.type === "cash" || g.type === "loan" ? `₱${g.amount?.toLocaleString()}` :
                 g.type === "equipment" ? `${g.equipmentQuantity ?? 1}x ${g.equipmentItem || ""}` :
                 `${g.amount} ${g.unit || ""}`}
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  g.status === "active" ? "bg-emerald-100 text-emerald-700" :
                  g.status === "overdue" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                }`}>{g.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LoansTab: React.FC<{ arboId: string; members: CoopMember[] }> = ({
  arboId,
  members,
}) => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const memberIds = members.map((m) => m.userId);
    if (memberIds.length === 0) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "grants"), where("type", "==", "loan")),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (memberIds.includes(data.beneficiaryId)) list.push({ id: d.id, ...data });
        });
        setLoans(list);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [members]);

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading loans...</div>;
  if (loans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <FileText size={32} className="text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-500 mb-1">No Loans</h3>
        <p className="text-xs text-slate-400">Outstanding loans for your members will be tracked here.</p>
      </div>
    );
  }

  const totalOutstanding = loans.reduce((s: number, l: any) => s + (l.remainingBalance ?? l.amount ?? 0), 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-indigo-900">{loans.length}</p>
          <p className="text-[9px] text-slate-400 uppercase">Total Loans</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-red-700">₱{totalOutstanding.toLocaleString()}</p>
          <p className="text-[9px] text-slate-400 uppercase">Outstanding</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-lg font-extrabold text-emerald-700">{loans.filter((l: any) => l.status === "active").length}</p>
          <p className="text-[9px] text-slate-400 uppercase">Active</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Interest</th>
              <th className="px-4 py-3 text-left">Remaining</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.map((l: any) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-bold text-slate-700">{l.beneficiaryName}</td>
                <td className="px-4 py-3 text-xs text-slate-800">₱{l.amount?.toLocaleString()}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{l.interestRate ?? 0}% · {l.loanTermMonths ?? 12}mo</td>
                <td className="px-4 py-3 text-xs font-bold text-indigo-700">₱{(l.remainingBalance ?? l.amount)?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    l.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                  }`}>{l.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
};

const NotesTab: React.FC<{ arboId: string }> = ({ arboId }) => {
  // Placeholder — will be populated in Phase 6
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
      <AlertCircle size={32} className="text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-500 mb-1">
        Admin Communications
      </h3>
      <p className="text-xs text-slate-400">
        Messages and notes from the DAR Administrator addressed to your ARBO
        will appear here. Use this to stay updated on requirements and
        announcements.
      </p>
    </div>
  );
};

export default ArboDashboard;

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { GrantCard } from "../components/GrantCard";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  TrendingUp,
  DollarSign,
  Package,
  FileText,
  Building2,
  MapPin,
  Users,
  X,
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

interface CoopMember {
  id: string;
  cooperativeId: string;
  userId: string;
  userName: string;
  joinedAt: string;
}

interface Cooperative {
  id: string;
  name: string;
  municipality: string;
  logo: string;
  headName: string;
  headId: string;
  createdAt: string;
}

export const MyGrants: React.FC = () => {
  const { user } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  // Cooperative info
  const [myCoop, setMyCoop] = useState<Cooperative | null>(null);
  const [myCoopMembers, setMyCoopMembers] = useState<CoopMember[]>([]);

  // UI state
  const [expandedGrant, setExpandedGrant] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const q = query(
      collection(db, "grants"),
      where("beneficiaryId", "==", user.uid),
    );
    const unsubGrants = onSnapshot(
      q,
      (snap) => {
        const list: Grant[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            type: data.type,
            description: data.description,
            amount: data.amount,
            unit: data.unit,
            dateProvided: data.dateProvided,
            reportCycle: data.reportCycle,
            nextReportDue: data.nextReportDue,
            status: data.status,
            createdAt: data.createdAt,
            cooperativeId: data.cooperativeId,
            cooperativeName: data.cooperativeName,
            isCoopGrant: data.isCoopGrant,
            interestRate: data.interestRate,
            loanTermMonths: data.loanTermMonths,
            remainingBalance: data.remainingBalance,
            equipmentItem: data.equipmentItem,
            equipmentQuantity: data.equipmentQuantity,
            unitValue: data.unitValue,
          });
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setGrants(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      },
    );

    return () => unsubGrants();
  }, [user]);

  // Check if user is in a cooperative
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(
        collection(db, "cooperativeMembers"),
        where("userId", "==", user.uid),
      ),
      async (snap) => {
        if (snap.empty) {
          setMyCoop(null);
          setMyCoopMembers([]);
          return;
        }
        const member = snap.docs[0].data() as CoopMember;
        member.id = snap.docs[0].id;
        member.cooperativeId = snap.docs[0].data().cooperativeId;

        // Fetch cooperative details
        const coopSnap = await import("firebase/firestore").then((m) =>
          m.getDoc(m.doc(db, "cooperatives", member.cooperativeId)),
        );
        if (coopSnap.exists()) {
          const data = coopSnap.data();
          setMyCoop({
            id: coopSnap.id,
            name: data.name,
            municipality: data.municipality,
            logo: data.logo || "",
            headName: data.headName,
            headId: data.headId,
            createdAt: data.createdAt,
          });
        }

        // Fetch all members of this cooperative
        const { getDocs } = await import("firebase/firestore");
        const membersSnap = await getDocs(
          query(
            collection(db, "cooperativeMembers"),
            where("cooperativeId", "==", member.cooperativeId),
          ),
        );
        const membersList: CoopMember[] = [];
        membersSnap.forEach((d) => {
          const mData = d.data();
          membersList.push({
            id: d.id,
            cooperativeId: mData.cooperativeId,
            userId: mData.userId,
            userName: mData.userName,
            joinedAt: mData.joinedAt,
          });
        });
        setMyCoopMembers(membersList);
      },
    );
    return () => unsub();
  }, [user]);

  const individualGrants = grants.filter((g) => !g.isCoopGrant);
  const coopGrants = grants.filter((g) => g.isCoopGrant);

  const totalIndividualCash = individualGrants
    .filter((g) => g.type === "cash")
    .reduce((s, g) => s + g.amount, 0);
  const totalCoopCash = coopGrants
    .filter((g) => g.type === "cash")
    .reduce((s, g) => s + g.amount, 0);

  const getGrantsForType = (list: Grant[], type: "cash" | "raw_materials") =>
    list.filter((g) => g.type === type);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              Grant & Profitability
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              My Grants Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            <TrendingUp size={14} className="text-emerald-700" />
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Live Data
            </span>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500">
                Loading your grants...
              </p>
            </div>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-4xl">
            {/* Cooperative Banner */}
            {myCoop && (
              <div className="bg-gradient-to-r from-indigo-50 to-slate-50 rounded-2xl border border-indigo-200 shadow-sm p-5 text-left">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center overflow-hidden shrink-0">
                    {myCoop.logo ? (
                      <img
                        src={myCoop.logo}
                        alt={myCoop.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 size={24} className="text-indigo-700" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        My ARBO
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {myCoop.name}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {myCoop.municipality}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Users size={12} />
                        {myCoopMembers.length} member
                        {myCoopMembers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {coopGrants.length > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-indigo-700">
                        {coopGrants.length} coop grant
                        {coopGrants.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-indigo-500">
                        ₱{totalCoopCash.toLocaleString()} total
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={16} className="text-emerald-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Indiv. Cash
                  </span>
                </div>
                <p className="text-xl font-extrabold text-emerald-900">
                  ₱{totalIndividualCash.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {getGrantsForType(individualGrants, "cash").length} grant(s)
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Package size={16} className="text-amber-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Indiv. Materials
                  </span>
                </div>
                <p className="text-xl font-extrabold text-amber-900">
                  {getGrantsForType(individualGrants, "raw_materials").length}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Material grant(s)
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={16} className="text-indigo-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Coop Grants
                  </span>
                </div>
                <p className="text-xl font-extrabold text-indigo-900">
                  {coopGrants.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  ₱{totalCoopCash.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={16} className="text-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Total Grants
                  </span>
                </div>
                <p className="text-xl font-extrabold text-slate-900">
                  {grants.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  ₱{(totalIndividualCash + totalCoopCash).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Grants List */}
            {grants.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <TrendingUp size={32} className="text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-500 mb-1">
                  No Grants Yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  You haven't received any government grants yet. Once the DAR
                  administration provides you with cash assistance or raw
                  materials, they will appear here for tracking and reporting.
                </p>
              </div>
            ) : (
              <>
                {/* Cooperative Grants */}
                {coopGrants.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <Building2 size={16} className="text-indigo-700" />
                      Cooperative Grants ({coopGrants.length})
                    </h2>
                    <div className="space-y-3">
                      {coopGrants.map((g) => (
                        <GrantCard
                          key={g.id}
                          grant={g}
                          expandedGrant={expandedGrant}
                          setExpandedGrant={setExpandedGrant}
                          showReportModal={showReportModal}
                          setShowReportModal={setShowReportModal}
                          setPreviewImage={setPreviewImage}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Cash Grants */}
                {getGrantsForType(individualGrants, "cash").length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <DollarSign size={16} className="text-emerald-700" />
                      Individual Cash Grants
                    </h2>
                    <div className="space-y-3">
                      {getGrantsForType(individualGrants, "cash").map((g) => (
                        <GrantCard
                          key={g.id}
                          grant={g}
                          expandedGrant={expandedGrant}
                          setExpandedGrant={setExpandedGrant}
                          showReportModal={showReportModal}
                          setShowReportModal={setShowReportModal}
                          setPreviewImage={setPreviewImage}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Individual Raw Materials */}
                {getGrantsForType(individualGrants, "raw_materials").length >
                  0 && (
                  <div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <Package size={16} className="text-amber-700" />
                      Individual Raw Materials
                    </h2>
                    <div className="space-y-3">
                      {getGrantsForType(individualGrants, "raw_materials").map(
                        (g) => (
                          <GrantCard
                            key={g.id}
                            grant={g}
                            expandedGrant={expandedGrant}
                            setExpandedGrant={setExpandedGrant}
                            showReportModal={showReportModal}
                            setShowReportModal={setShowReportModal}
                            setPreviewImage={setPreviewImage}
                          />
                        ),
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        )}
      </div>

      {/* Image preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-slate-800 text-white rounded-full h-8 w-8 flex items-center justify-center shadow-lg hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

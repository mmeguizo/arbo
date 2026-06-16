import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { uploadFile } from "../utils/storage";
import {
  Users,
  Building2,
  MapPin,
  Plus,
  X,
  Edit3,
  Trash2,
  Upload,
  Check,
  Search,
} from "lucide-react";

import localityData from "../data/locality.json";

interface Cooperative {
  id: string;
  name: string;
  address: string;
  municipality: string;
  barangay?: string;
  province: string;
  logo: string;
  headId: string;
  headName: string;
  createdAt: string;
}

interface CoopMember {
  id: string;
  cooperativeId: string;
  userId: string;
  userName: string;
  userMunicipality: string;
  userBarangay: string;
  joinedAt: string;
}

interface ARBUser {
  uid: string;
  name: string;
  municipality: string;
  barangay: string;
}

export const CooperativeManagement: React.FC = () => {
  const { profile } = useAuth();
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [members, setMembers] = useState<CoopMember[]>([]);
  const [arbUsers, setArbUsers] = useState<ARBUser[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoop, setEditingCoop] = useState<Cooperative | null>(null);
  const [expandedCoop, setExpandedCoop] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formProvince, setFormProvince] = useState("Negros Occidental");
  const [formMunicipality, setFormMunicipality] = useState("");
  const [formBarangay, setFormBarangay] = useState("");
  const [formLogo, setFormLogo] = useState("");
  const [formHeadId, setFormHeadId] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Member search
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    const unsubCoops = onSnapshot(collection(db, "cooperatives"), (snap) => {
      const list: Cooperative[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name,
          address: data.address,
          municipality: data.municipality,
          barangay: data.barangay || "",
          province: data.province,
          logo: data.logo || "",
          headId: data.headId,
          headName: data.headName,
          createdAt: data.createdAt,
        });
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setCooperatives(list);
    });

    const unsubMembers = onSnapshot(
      collection(db, "cooperativeMembers"),
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
        setLoading(false);
      },
    );

    const unsubARBs = onSnapshot(
      query(collection(db, "users"), where("role", "==", "arb")),
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

    return () => {
      unsubCoops();
      unsubMembers();
      unsubARBs();
    };
  }, []);

  const getCoopMembers = (coopId: string) =>
    members.filter((m) => m.cooperativeId === coopId);

  // All municipalities from locality data, cascaded by province
  const allMunicipalities = useMemo(() => {
    const province = localityData.provinces.find(
      (p) => p.name === formProvince,
    );
    return province?.municipalities.map((m) => m.name).sort() || [];
  }, [formProvince]);

  // Barangays for selected municipality
  const allBarangays = useMemo(() => {
    if (!formProvince || !formMunicipality) return [];
    const province = localityData.provinces.find(
      (p) => p.name === formProvince,
    );
    const mun = province?.municipalities.find(
      (m) => m.name === formMunicipality,
    );
    return mun?.barangays.map((b) => b.name).sort() || [];
  }, [formProvince, formMunicipality]);

  // All municipalities for display (from locality data)

  // All ARB/arbo_head users (for head selector)
  const eligibleHeads = useMemo(() => {
    return arbUsers.filter((a) => a.uid);
  }, [arbUsers]);

  const handleLogoUpload = async (file: File): Promise<string> => {
    const path = `cooperatives/logos/${Date.now()}_${file.name}`;
    const url = await uploadFile(file, path);
    return url;
  };

  const createCooperative = async () => {
    if (!formName.trim()) {
      setFormError("ARBO name is required.");
      return;
    }
    setFormError(null);
    setSubmitting(true);

    try {
      const selectedHead = formHeadId
        ? arbUsers.find((a) => a.uid === formHeadId)
        : null;
      await addDoc(collection(db, "cooperatives"), {
        name: formName.trim(),
        address: formAddress.trim(),
        municipality: formMunicipality || null,
        barangay: formBarangay || null,
        province: formProvince,
        logo: formLogo,
        headId: formHeadId || "",
        headName: selectedHead?.name || "Unassigned",
        createdAt: new Date().toISOString(),
      });

      // If a head was selected, update their role to arbo_head and set arboId
      if (formHeadId) {
        // Note: we don't have the new arbo ID yet from addDoc, but we can query it
        // For now, the ArboDashboard queries by headId which works
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError("Failed to create ARBO.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateCooperative = async () => {
    if (!editingCoop || !formName.trim()) {
      setFormError("ARBO name is required.");
      return;
    }
    setFormError(null);
    setSubmitting(true);

    try {
      const selectedHead = formHeadId
        ? arbUsers.find((a) => a.uid === formHeadId)
        : null;
      await updateDoc(doc(db, "cooperatives", editingCoop.id), {
        name: formName.trim(),
        address: formAddress.trim(),
        municipality: formMunicipality || null,
        barangay: formBarangay || null,
        province: formProvince,
        logo: formLogo || editingCoop.logo,
        headId: formHeadId || editingCoop.headId,
        headName: selectedHead?.name || editingCoop.headName,
      });

      setEditingCoop(null);
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError("Failed to update ARBO.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCooperative = async (coop: Cooperative) => {
    if (!confirm(`Delete ARBO "${coop.name}" and all its members?`)) return;
    try {
      // Remove all members first
      const coopMembers = getCoopMembers(coop.id);
      await Promise.all(
        coopMembers.map((m) => deleteDoc(doc(db, "cooperativeMembers", m.id))),
      );
      await deleteDoc(doc(db, "cooperatives", coop.id));
    } catch (err) {
      console.error(err);
    }
  };

  const addMember = async (coopId: string, arb: ARBUser) => {
    try {
      await addDoc(collection(db, "cooperativeMembers"), {
        cooperativeId: coopId,
        userId: arb.uid,
        userName: arb.name,
        userMunicipality: arb.municipality,
        userBarangay: arb.barangay,
        joinedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await deleteDoc(doc(db, "cooperativeMembers", memberId));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormAddress("");
    setFormProvince("Negros Occidental");
    setFormMunicipality("");
    setFormBarangay("");
    setFormLogo("");
    setFormHeadId("");
    setFormError(null);
  };

  // All ARBs available to add (no geo restriction), already-in-this-ARBO excluded
  const getAvailableARBsForCoop = (coop: Cooperative) => {
    const alreadyMemberIds = new Set(
      members.filter((m) => m.cooperativeId === coop.id).map((m) => m.userId),
    );

    let filtered = arbUsers.filter((a) => !alreadyMemberIds.has(a.uid));

    if (memberSearch.trim()) {
      const term = memberSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.municipality.toLowerCase().includes(term) ||
          a.barangay.toLowerCase().includes(term),
      );
    }

    return filtered.slice(0, 50); // limit to 50 for performance
  };

  const openEditModal = (coop: Cooperative) => {
    setEditingCoop(coop);
    setFormName(coop.name);
    setFormAddress(coop.address);
    setFormProvince(coop.province || "Negros Occidental");
    setFormMunicipality(coop.municipality || "");
    setFormBarangay("");
    setFormLogo(coop.logo);
    setFormHeadId(coop.headId || "");
    setFormError(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              ARBO Registry
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              ARBO Management
            </h1>
          </div>
          {profile?.role === "admin" && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                resetForm();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer"
            >
              <Plus size={14} />
              Create ARBO
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
              <p className="text-xs text-slate-500">Loading ARBOs...</p>
            </div>
          </div>
        ) : (
          <main className="p-8 space-y-8 max-w-5xl">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={16} className="text-emerald-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Total ARBOs
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-emerald-900">
                  {cooperatives.length}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-indigo-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Total Members
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-indigo-900">
                  {members.length}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={16} className="text-amber-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Municipalities Covered
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-amber-900">
                  {new Set(cooperatives.map((c) => c.municipality)).size}
                </p>
              </div>
            </div>

            {/* Cooperatives List */}
            {cooperatives.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-500 mb-1">
                  No ARBOs Yet
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Create ARBOs to group ARB members within the same municipality
                  for collective grant distribution.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cooperatives.map((coop) => {
                  const coopMembers = getCoopMembers(coop.id);
                  const isExpanded = expandedCoop === coop.id;
                  return (
                    <div
                      key={coop.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      {/* Coop Header */}
                      <div
                        onClick={() => {
                          setExpandedCoop(isExpanded ? null : coop.id);
                          setMemberSearch("");
                        }}
                        className="p-5 flex items-start gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="h-14 w-14 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center overflow-hidden shrink-0">
                          {coop.logo ? (
                            <img
                              src={coop.logo}
                              alt={coop.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Building2 size={24} className="text-emerald-700" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-bold text-slate-900 text-sm">
                            {coop.name}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} />
                            {coop.municipality || "—"}
                            {coop.province && `, ${coop.province}`}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                              {coopMembers.length} member
                              {coopMembers.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Head: {coop.headName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded - Members */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                          {/* Members List */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Members ({coopMembers.length})
                              </h4>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(coop);
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 size={10} />
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCooperative(coop);
                                  }}
                                  className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg border border-red-200 hover:border-red-300 cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 size={10} />
                                  Delete
                                </button>
                              </div>
                            </div>

                            {coopMembers.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                No members yet.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {coopMembers.map((member) => (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-700">
                                        {member.userName}
                                      </span>
                                      <span className="text-slate-400 ml-2">
                                        {member.userMunicipality}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => removeMember(member.id)}
                                      className="text-red-400 hover:text-red-600 cursor-pointer"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add Member Section */}
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                                Add Member
                              </p>
                              <div className="relative mb-2">
                                <Search
                                  size={12}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                  type="text"
                                  placeholder="Search users by name or municipality..."
                                  value={memberSearch}
                                  onChange={(e) =>
                                    setMemberSearch(e.target.value)
                                  }
                                  className="block w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[10px] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                              {getAvailableARBsForCoop(coop).length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic">
                                  {memberSearch.trim()
                                    ? "No matching users found."
                                    : "All ARBs are already members."}
                                </p>
                              ) : (
                                <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                                  {getAvailableARBsForCoop(coop).map((arb) => (
                                    <button
                                      key={arb.uid}
                                      onClick={() => {
                                        addMember(coop.id, arb);
                                        setMemberSearch("");
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                                    >
                                      <Plus size={10} />
                                      {arb.name}
                                      <span className="text-slate-400 font-normal">
                                        ({arb.municipality})
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
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

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCoop) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 my-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-sm text-slate-900">
                {editingCoop ? "Edit ARBO" : "Create ARBO"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCoop(null);
                  resetForm();
                }}
                className="text-slate-400 hover:bg-slate-200 p-2 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Name */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  ARBO Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., San Jose Farmers ARBO"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Province */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Province
                </label>
                <select
                  value={formProvince}
                  onChange={(e) => {
                    setFormProvince(e.target.value);
                    setFormMunicipality("");
                    setFormBarangay("");
                  }}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {localityData.provinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Municipality */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Municipality
                </label>
                <select
                  value={formMunicipality}
                  onChange={(e) => {
                    setFormMunicipality(e.target.value);
                    setFormBarangay("");
                  }}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">None (skip)</option>
                  {allMunicipalities.map((mun) => (
                    <option key={mun} value={mun}>
                      {mun}
                    </option>
                  ))}
                </select>
              </div>

              {/* Barangay */}
              {formMunicipality && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Barangay
                  </label>
                  <select
                    value={formBarangay}
                    onChange={(e) => setFormBarangay(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">None (skip)</option>
                    {allBarangays.map((brgy) => (
                      <option key={brgy} value={brgy}>
                        {brgy}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g., Barangay 3, San Jose"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* ARBO Head Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  ARBO Head
                </label>
                <select
                  value={formHeadId}
                  onChange={(e) => setFormHeadId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select a head...</option>
                  {eligibleHeads.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.name} ({a.municipality})
                    </option>
                  ))}
                </select>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  ARBO Logo
                </label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {formLogo ? (
                      <img
                        src={formLogo}
                        alt="Logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 size={20} className="text-slate-400" />
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 py-2 px-3 text-[10px] font-bold text-slate-600 cursor-pointer transition-colors">
                    {uploadingLogo ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingLogo(true);
                        try {
                          const url = await handleLogoUpload(file);
                          setFormLogo(url);
                        } catch {
                          setFormError("Failed to upload logo.");
                        }
                        setUploadingLogo(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {formLogo && (
                    <button
                      onClick={() => setFormLogo("")}
                      className="text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCoop(null);
                  resetForm();
                }}
                className="rounded-lg border border-slate-200 bg-white text-slate-700 py-2 px-4 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={editingCoop ? updateCooperative : createCooperative}
                disabled={submitting}
                className="rounded-lg bg-emerald-800 hover:bg-emerald-950 text-white py-2 px-5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Check size={14} />
                )}
                {editingCoop ? "Save Changes" : "Create ARBO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

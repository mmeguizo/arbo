import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  MapPin,
  Check,
  AlertCircle,
  Hash,
  Layers,
  Map,
  Compass,
  FileCheck,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import localityData from "../data/locality.json";

interface ApprovedApplicant {
  id: string;
  userId: string;
  userName: string;
  userMunicipality: string;
  userBarangay: string;
  userProvince: string;
}

const PAGE_SIZE = 20;

export const LandTitles: React.FC = () => {
  const { profile } = useAuth();
  const [applicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Pagination
  const [allApplicants, setAllApplicants] = useState<ApprovedApplicant[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Form Fields
  const [selectedAppId, setSelectedAppId] = useState("");
  const [titleNumber, setTitleNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");

  const [errorVisible, setError] = useState<string | null>(null);

  const municipalities = province
    ? localityData.provinces.find((p) => p.name === province)?.municipalities || []
    : [];

  const fetchApprovedApplicants = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "applications"),
        where("status", "==", "verified"),
        orderBy("submittedAt", "desc"),
      );
      const snap = await getDocs(q);

      const titleSnap = await getDocs(collection(db, "landTitles"));
      const encodedIds = new Set<string>();
      titleSnap.forEach((d) => {
        const data = d.data();
        if (data.applicationId) encodedIds.add(data.applicationId);
      });

      const list: ApprovedApplicant[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (!encodedIds.has(d.id)) {
          list.push({
            id: d.id,
            userId: data.userId,
            userName: data.userName || "Unknown",
            userMunicipality: data.userMunicipality || "",
            userBarangay: data.userBarangay || "",
            userProvince: data.userProvince || "Negros Occidental",
          });
        }
      });

      setAllApplicants(list);
      setTotalCount(list.length);
      setPage(0);
      setApprovedApplicants(list.slice(0, PAGE_SIZE));
      setHasMore(list.length > PAGE_SIZE);
      if (list.length > 0) {
        setSelectedAppId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load approved apps list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedApplicants();
  }, []);

  const handlePrevPage = () => {
    if (page <= 0) return;
    const newPage = page - 1;
    setPage(newPage);
    setApprovedApplicants(allApplicants.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE));
    setHasMore(true);
  };

  const handleNextPage = () => {
    const newPage = page + 1;
    if (newPage * PAGE_SIZE >= allApplicants.length) return;
    setPage(newPage);
    setApprovedApplicants(allApplicants.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE));
    setHasMore((newPage + 1) * PAGE_SIZE < allApplicants.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitted(false);

    if (
      !selectedAppId ||
      !titleNumber ||
      !lotNumber ||
      !areaHectares ||
      !geoLat ||
      !geoLng ||
      !province ||
      !municipality
    ) {
      setError("Please complete all geographic land fields.");
      return;
    }

    const cleanTitle = titleNumber.trim().toUpperCase();

    try {
      setLoading(true);

      const duplicateQuery = query(
        collection(db, "landTitles"),
        where("titleNumber", "==", cleanTitle),
      );
      const dupSnap = await getDocs(duplicateQuery);

      if (!dupSnap.empty) {
        setError(
          `CRITICAL WARNING: The Land Title ID: '${cleanTitle}' is already registered in our database! Double registration is blocked to prevent professional squatters.`,
        );
        setLoading(false);
        return;
      }

      const selectedAppRecord = allApplicants.find((a) => a.id === selectedAppId);
      if (!selectedAppRecord) {
        setError("Invalid applicant selected.");
        setLoading(false);
        return;
      }

      const generatedTitleId = `TTL-${Math.floor(100000 + Math.random() * 900000)}`;

      await setDoc(doc(db, "landTitles", generatedTitleId), {
        titleId: generatedTitleId,
        applicationId: selectedAppRecord.id,
        beneficiaryId: selectedAppRecord.userId,
        beneficiaryName: selectedAppRecord.userName,
        titleNumber: cleanTitle,
        lotNumber: lotNumber.trim(),
        areaHectares: Number(areaHectares),
        province: province,
        municipality: municipality,
        geoLat: geoLat.trim(),
        geoLng: geoLng.trim(),
        surveyorId: profile?.name || "Surveyor Officer",
        encodedAt: new Date().toISOString(),
      });

      const appDocRef = doc(db, "applications", selectedAppRecord.id);
      await updateDoc(appDocRef, {
        status: "awarded",
        surveyorEncodedAt: new Date().toISOString(),
        surveyorName: profile?.name || "Surveyor Officer",
        titleNumber: cleanTitle,
      });

      setSubmitted(true);
      setTitleNumber("");
      setLotNumber("");
      setAreaHectares("");
      setGeoLat("");
      setGeoLng("");
      setProvince("");
      setMunicipality("");

      await fetchApprovedApplicants();
    } catch (err) {
      console.error("Failed to save land title mapping:", err);
      setError("An unexpected database error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR Surveyor Office
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Land Title Entry Dashboard
            </h1>
          </div>
        </header>

        <main className="p-8 max-w-4xl space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Encode New Verified Land Parcel
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Only applications that have obtained full Administrative Approval
              (Verified status) can be mapped and have their Title Number (OCT /
              TCT) stored in the registry.
            </p>

            {submitted && (
              <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800">
                <FileCheck size={18} className="shrink-0 mt-0.5" />
                <span className="font-semibold">
                  Success! The Land Title mapping has been registered, locked,
                  and is now active on the beneficiary's portal.
                </span>
              </div>
            )}

            {errorVisible && (
              <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-red-550 bg-red-50 p-4 border border-red-200 text-sm text-red-500">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="font-semibold">{errorVisible}</span>
              </div>
            )}

            {loading && allApplicants.length === 0 ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                Scanning eligible approved applications...
              </div>
            ) : allApplicants.length === 0 ? (
              <div className="py-8 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 italic text-xs bg-slate-50/40">
                No approved applications currently await surveyor mapping. Tell
                municipal evaluators to verify candidate records.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Approved Beneficiary
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                  >
                    {applicants.map((appItem) => {
                      const appProvince = appItem.userProvince || "Negros Occidental";
                      return (
                        <option key={appItem.id} value={appItem.id}>
                          {appItem.userName} ({appItem.userBarangay}, {appProvince}) - ID: {appItem.id}
                        </option>
                      );
                    })}
                  </select>
                  {totalCount > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                      <span>Showing {applicants.length} of {totalCount} applicants</span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handlePrevPage}
                          disabled={page === 0}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="font-semibold">Page {page + 1} of {totalPages}</span>
                        <button
                          type="button"
                          onClick={handleNextPage}
                          disabled={!hasMore}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      OCT / TCT Title Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Hash size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        value={titleNumber}
                        onChange={(e) => setTitleNumber(e.target.value)}
                        placeholder="TCT-123456"
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Lot Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Layers size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="Lot 52-B"
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Land Area Hectares
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Map size={16} />
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={areaHectares}
                        onChange={(e) => setAreaHectares(e.target.value)}
                        placeholder="1.0"
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Province
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Globe size={16} />
                      </div>
                      <select
                        required
                        value={province}
                        onChange={(e) => { setProvince(e.target.value); setMunicipality(""); }}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold appearance-none"
                      >
                        <option value="">-- Select Province --</option>
                        {localityData.provinces.map((p) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Municipality / City
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <MapPin size={16} />
                      </div>
                      <select
                        required
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        disabled={!province}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold appearance-none disabled:opacity-50"
                      >
                        <option value="">{province ? "-- Choose Municipality --" : "Select province first"}</option>
                        {municipalities.map((m) => (
                          <option key={m.code} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="md:col-span-2 text-xs font-bold text-slate-600 flex items-center space-x-1.5 mb-1 header">
                    <Compass size={16} className="text-emerald-800" />
                    <span>Exact Boundaries Geographic Coordinates (GPS)</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Latitude
                    </label>
                    <input
                      type="text"
                      required
                      value={geoLat}
                      onChange={(e) => setGeoLat(e.target.value)}
                      placeholder="10.2831"
                      className="block w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Longitude
                    </label>
                    <input
                      type="text"
                      required
                      value={geoLng}
                      onChange={(e) => setGeoLng(e.target.value)}
                      placeholder="122.9912"
                      className="block w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 py-3.5 px-8 text-sm font-semibold text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <>
                        <Check size={16} className="stroke-3" />
                        <span>Audit and Register Title Parcel</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

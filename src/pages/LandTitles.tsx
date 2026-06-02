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
} from "lucide-react";

interface ApprovedApplicant {
  id: string; // application id
  userId: string;
  userName: string;
  userBarangay: string;
}

// Municipalities of Negros Occidental
const MUNICIPALITIES = [
  "Bago City",
  "Isabela",
  "La Carlota",
  "Kabankalan",
  "Cadiz City",
  "Himamaylan",
  "Sagay City",
  "Silay City",
  "Victorias City",
  "San Carlos City",
  "Pontevedra",
  "Hinigaran",
  "Pulupandan",
  "Valladolid",
  "San Enrique",
  "Binalbagan",
  "Moises Padilla",
  "Calatrava",
  "Toboso",
  "Don Salvador Benedicto",
  "Murcia",
  "Talisay City",
  "Manapla",
  "E.B. Magalona",
  "Cauayan",
  "Ilog",
  "Candoni",
  "Hinoba-an",
  "Sipalay City",
].sort();

export const LandTitles: React.FC = () => {
  const { profile } = useAuth();
  const [applicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Form Fields
  const [selectedAppId, setSelectedAppId] = useState("");
  const [titleNumber, setTitleNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [municipality, setMunicipality] = useState("");

  const [errorVisible, setError] = useState<string | null>(null);

  const fetchApprovedApplicants = async () => {
    try {
      setLoading(true);
      // Fetch applications where status is verified
      const q = query(
        collection(db, "applications"),
        where("status", "==", "verified"),
      );
      const snap = await getDocs(q);
      const list: ApprovedApplicant[] = [];

      // Also fetch already registered land titles to make sure we don't list already encoded ones
      const titleSnap = await getDocs(collection(db, "landTitles"));
      const encodedIds = new Set<string>();
      titleSnap.forEach((d) => {
        const data = d.data();
        if (data.applicationId) encodedIds.add(data.applicationId);
      });

      snap.forEach((d) => {
        const data = d.data();
        if (!encodedIds.has(d.id)) {
          list.push({
            id: d.id,
            userId: data.userId,
            userName: data.userName || "Unknown",
            userBarangay: data.userBarangay || "Isabela",
          });
        }
      });
      setApprovedApplicants(list);
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
      !municipality
    ) {
      setError("Please complete all geographic land fields.");
      return;
    }

    const cleanTitle = titleNumber.trim().toUpperCase();

    try {
      setLoading(true);

      // Check duplicate Land Title Number (Professional squatter / multi-title application check!)
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

      // Selected applicant info
      const selectedAppRecord = applicants.find((a) => a.id === selectedAppId);
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
        municipality: municipality,
        geoLat: geoLat.trim(),
        geoLng: geoLng.trim(),
        surveyorId: profile?.name || "Surveyor Officer",
        encodedAt: new Date().toISOString(),
      });

      // Clear Form and mark success
      setSubmitted(true);
      setTitleNumber("");
      setLotNumber("");
      setAreaHectares("");
      setGeoLat("");
      setGeoLng("");
      setMunicipality("");

      // Reload lists
      await fetchApprovedApplicants();
    } catch (err) {
      console.error("Failed to save land title mapping:", err);
      setError("An unexpected database error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
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

            {loading && !selectedAppId ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                Scanning eligible approved applications...
              </div>
            ) : applicants.length === 0 ? (
              <div className="py-8 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 italic text-xs bg-slate-50/40">
                No approved applications currently await surveyor mapping. Tell
                municipal evaluators to verify candidate records.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Select Candidate Approved application */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Approved Beneficiary
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                  >
                    {applicants.map((appItem) => (
                      <option key={appItem.id} value={appItem.id}>
                        {appItem.userName} ({appItem.userBarangay}) - ID:{" "}
                        {appItem.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Title Number */}
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

                  {/* Lot Number */}
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
                  {/* Land Area */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Land Area Hectares (1 Hectare default)
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

                  {/* Negros Occ Municipality lists */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Municipality Location (Negros Occidental)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <MapPin size={16} />
                      </div>
                      <select
                        required
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
                      >
                        <option value="">-- Choose Municipality --</option>
                        {MUNICIPALITIES.map((mun) => (
                          <option key={mun} value={mun}>
                            {mun}
                          </option>
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

                  {/* Coordinates: Latitude */}
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

                  {/* Coordinates: Longitude */}
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

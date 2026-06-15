import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Search as SearchIcon,
  MapPin,
  Layers,
  Compass,
  User,
  ShieldAlert,
  Hash,
  Eye,
  X,
  Calendar,
  Globe,
  FileText,
  Phone,
  Mail,
  Camera,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SearchResult {
  titleId: string;
  applicationId: string;
  beneficiaryId: string;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  province: string;
  geoLat: string;
  geoLng: string;
  beneficiaryName: string;
  encoderId: string;
  encodedAt: string;
  landPhotos?: string[];
  status?: string;
  titleType?: string;
  cloaType?: string | null;
  aspPsdNumber?: string;
}

interface BeneficiaryProfile {
  name: string;
  email: string;
  contact: string;
  address: string;
  barangay: string;
  municipality: string;
  province: string;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  oldStatus: string | null;
  newStatus: string;
  notes: string;
}

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<SearchResult | null>(
    null,
  );
  const [beneficiaryProfile, setBeneficiaryProfile] =
    useState<BeneficiaryProfile | null>(null);
  const [titleAuditLogs, setTitleAuditLogs] = useState<AuditEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Fix Leaflet default icon
  const defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // Fetch beneficiary profile + audit logs when a record is selected
  useEffect(() => {
    if (!selectedRecord) {
      setBeneficiaryProfile(null);
      setTitleAuditLogs([]);
      return;
    }

    let cancelled = false;
    const fetchDetails = async () => {
      setDetailLoading(true);

      try {
        // Fetch beneficiary profile
        if (selectedRecord.beneficiaryId) {
          try {
            const userRef = doc(db, "users", selectedRecord.beneficiaryId);
            const userSnap = await getDoc(userRef);
            if (!cancelled && userSnap.exists()) {
              setBeneficiaryProfile(userSnap.data() as BeneficiaryProfile);
            } else if (!cancelled) {
              setBeneficiaryProfile(null);
            }
          } catch {
            if (!cancelled) setBeneficiaryProfile(null);
          }
        } else {
          setBeneficiaryProfile(null);
        }

        // Fetch audit logs for this application
        if (selectedRecord.applicationId) {
          try {
            const logsQ = query(
              collection(db, "auditLogs"),
              where("applicationId", "==", selectedRecord.applicationId),
            );
            const logsSnap = await getDocs(logsQ);
            if (!cancelled) {
              const logs: AuditEntry[] = [];
              logsSnap.forEach((d) => {
                logs.push({ id: d.id, ...d.data() } as AuditEntry);
              });
              // Sort client-side by timestamp descending
              logs.sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime(),
              );
              setTitleAuditLogs(logs);
            }
          } catch {
            if (!cancelled) setTitleAuditLogs([]);
          }
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedRecord]);

  // Load all titles from Firestore with real-time listener
  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, "landTitles");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: SearchResult[] = [];
        snap.forEach((d) => {
          list.push(d.data() as SearchResult);
        });
        setRecords(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load title search indices:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Filter list when query or records change
  useEffect(() => {
    const term = queryParam.trim().toLowerCase();
    if (!term) {
      setFilteredRecords(records);
      return;
    }

    const filtered = records.filter((r) => {
      return (
        r.titleNumber.toLowerCase().includes(term) ||
        r.beneficiaryName.toLowerCase().includes(term) ||
        r.lotNumber.toLowerCase().includes(term) ||
        r.municipality.toLowerCase().includes(term)
      );
    });

    setFilteredRecords(filtered);
  }, [queryParam, records]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: searchQuery.trim() });
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-10">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR PH National Registry
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Search Land Title Registry
            </h1>
          </div>
        </header>

        {/* Content Panel Area */}
        <main className="flex-1 p-8 space-y-6 overflow-y-auto">
          {/* Main search box block */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left max-w-4xl">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Search Registry
            </h3>
            <p className="text-[10px] text-slate-400 mb-4">
              Query database instantly by OCT/TCT number, Lot number,
              Beneficiary name, or municipality.
            </p>

            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <SearchIcon size={18} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter Title Number (TCT-456789) or Beneficiary Name..."
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs py-3 px-6 transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Search</span>
              </button>
            </form>
          </div>

          {/* Results Summary banner */}
          <div className="text-left font-bold text-slate-500 text-xs px-2 flex items-center space-x-2">
            <span>Query Results:</span>
            <span className="bg-emerald-50 border border-emerald-105 text-emerald-800 px-2 py-0.5 rounded-full">
              {filteredRecords.length} Match
              {filteredRecords.length !== 1 && "es"} found
            </span>
          </div>

          {/* Search results list table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-left overflow-hidden max-w-5xl">
            {loading ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-800 border-t-transparent"></div>
                <p className="text-xs font-semibold">Indexing records...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-slate-550 uppercase tracking-widest text-[9px] font-bold">
                    <tr>
                      <th scope="col" className="px-6 py-4">
                        Title Info
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Beneficiary
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Location & Coordinates
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Hectarage
                      </th>
                      <th scope="col" className="px-6 py-4">
                        Encoded By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredRecords.map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedRecord(item)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        {/* Title no */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2.5">
                            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                              <Hash size={16} />
                            </span>
                            <div>
                              <p className="font-extrabold text-slate-900 m-0">
                                {item.titleNumber}
                              </p>
                              <p className="text-[10px] text-slate-400 m-0">
                                Lot: {item.lotNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Beneficiary */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2.5">
                            <span
                              className={`p-2 rounded-lg ${
                                item.status === "unassigned"
                                  ? "bg-slate-100 text-slate-400"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              <User size={16} />
                            </span>
                            {item.status === "unassigned" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                Unassigned
                              </span>
                            ) : (
                              <span className="font-bold text-slate-800">
                                {item.beneficiaryName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Hec */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-800 font-bold">
                          <span className="inline-flex items-center space-x-1.5">
                            <Layers size={14} className="text-slate-400" />
                            <span>{item.areaHectares} ha</span>
                          </span>
                        </td>

                        {/* Encoder ID */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="text-slate-450 italic text-xs">
                              {item.encoderId}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(item);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredRecords.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-slate-450 italic"
                        >
                          <div className="max-w-md mx-auto text-center space-y-2">
                            <ShieldAlert
                              size={24}
                              className="text-amber-600 mx-auto"
                            />
                            <p className="font-semibold text-slate-700">
                              No Registry Match found.
                            </p>
                            <p className="text-[10px] text-slate-400 leading-normal">
                              Double check Title card characters or beneficiary
                              name spelling. If new, confirm encoders have
                              submitted the coordinate records.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Title Detail Modal — Enhanced */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden text-left border border-slate-200 my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <Hash size={18} className="text-emerald-800" />
                <div>
                  <h3 className="font-bold text-slate-900">
                    Title Record Details
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {selectedRecord.titleId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* === CLOA Title Summary Card === */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-800">
                  Certificate of Land Ownership Award
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">
                      Title #
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-lg">
                      {selectedRecord.titleNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">
                      Lot #
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedRecord.lotNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">
                      Area
                    </span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Layers size={14} className="text-emerald-700" />
                      {selectedRecord.areaHectares} ha
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">
                      Status
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      <FileText size={10} />
                      Active Title
                    </span>
                  </div>
                </div>
              </div>

              {/* === Beneficiary Info === */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                  <User size={14} className="text-indigo-600" />
                  Beneficiary Details
                </h4>
                {detailLoading ? (
                  <div className="text-xs text-slate-400 italic">
                    Loading profile...
                  </div>
                ) : beneficiaryProfile ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">
                        Name
                      </span>
                      <span className="font-bold text-slate-900">
                        {beneficiaryProfile.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">
                        Contact
                      </span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        {beneficiaryProfile.contact || "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">
                        Email
                      </span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Mail size={12} className="text-slate-400" />
                        {beneficiaryProfile.email || "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[9px] text-slate-400 uppercase block font-bold">
                        Address
                      </span>
                      <span className="font-bold text-slate-900">
                        {beneficiaryProfile.address
                          ? `${beneficiaryProfile.address}, `
                          : ""}
                        {beneficiaryProfile.barangay
                          ? `${beneficiaryProfile.barangay}, `
                          : ""}
                        {beneficiaryProfile.municipality ||
                          selectedRecord.municipality}
                        {beneficiaryProfile.province
                          ? `, ${beneficiaryProfile.province}`
                          : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    {selectedRecord.beneficiaryName}
                    <span className="text-slate-300 ml-1">
                      (profile unavailable)
                    </span>
                  </div>
                )}
              </div>

              {/* === Location & Map === */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-5 pb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-700" />
                    Location &amp; Map View
                  </h4>
                </div>
                <div className="px-5 pb-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Globe size={12} />
                    {selectedRecord.municipality},{" "}
                    {selectedRecord.province || "Negros Occidental"}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                    <Compass size={12} />
                    Lat: {selectedRecord.geoLat}, Lng: {selectedRecord.geoLng}
                  </span>
                </div>
                {selectedRecord.geoLat && selectedRecord.geoLng && (
                  <div className="h-56 border-t border-slate-200">
                    <MapContainer
                      center={[
                        parseFloat(selectedRecord.geoLat),
                        parseFloat(selectedRecord.geoLng),
                      ]}
                      zoom={15}
                      style={{ height: "100%", width: "100%" }}
                      scrollWheelZoom={false}
                      dragging={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={[
                          parseFloat(selectedRecord.geoLat),
                          parseFloat(selectedRecord.geoLng),
                        ]}
                        icon={defaultIcon}
                      />
                    </MapContainer>
                  </div>
                )}
              </div>

              {/* === Land Photos Gallery === */}
              {selectedRecord.landPhotos &&
                selectedRecord.landPhotos.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                      <Camera size={14} className="text-emerald-700" />
                      Land Photos ({selectedRecord.landPhotos.length})
                    </h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {selectedRecord.landPhotos.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewPhoto(src)}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
                        >
                          <img
                            src={src}
                            alt={`Land photo ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* === Audit Trail === */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                  <ClipboardList size={14} className="text-slate-500" />
                  Application Audit Trail ({titleAuditLogs.length})
                </h4>
                {detailLoading ? (
                  <div className="text-xs text-slate-400 italic">
                    Loading logs...
                  </div>
                ) : titleAuditLogs.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">
                    No audit logs for this application.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {titleAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <Calendar
                          size={12}
                          className="text-slate-300 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-700">
                              {log.actor}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                              {log.actorRole}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-slate-600">
                            {log.oldStatus && (
                              <>
                                <span className="capitalize">
                                  {log.oldStatus.replace(/_/g, " ")}
                                </span>
                                <ArrowRight
                                  size={10}
                                  className="text-slate-300"
                                />
                              </>
                            )}
                            <span className="font-bold capitalize">
                              {log.newStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-slate-400 italic mt-0.5 truncate">
                              "{log.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* === Encoded By Footer === */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span className="text-xs text-slate-500">
                    Encoded by{" "}
                    <span className="font-bold text-slate-700">
                      {selectedRecord.encoderId}
                    </span>
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {selectedRecord.encodedAt
                    ? new Date(selectedRecord.encodedAt).toLocaleDateString(
                        "en-US",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "—"}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end sticky bottom-0">
              <button
                onClick={() => setSelectedRecord(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={previewPhoto}
              alt="Land photo"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
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

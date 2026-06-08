import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  addDoc,
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
  Camera,
  Upload,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import localityData from "../data/locality.json";

interface ApprovedApplicant {
  id: string;
  userId: string;
  userName: string;
  userMunicipality: string;
  userBarangay: string;
  userProvince: string;
  submittedAt?: string;
}

const PAGE_SIZE = 20;

// Leaflet helper: handle map clicks to drop a pin
const MapClickHandler: React.FC<{
  onPinDrop: (lat: number, lng: number) => void;
}> = ({ onPinDrop }) => {
  useMapEvents({
    click(e) {
      onPinDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Leaflet helper: sync map center from state
const MapCenterUpdater: React.FC<{
  center: [number, number];
  zoom: number;
}> = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

export const LandTitles: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [applicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState("");

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

  // Map & photo state
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    10.2831, 122.9912,
  ]); // Negros default
  const [mapZoom, setMapZoom] = useState(10);
  const [landPhotos, setLandPhotos] = useState<string[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [errorVisible, setError] = useState<string | null>(null);

  // Fix Leaflet default icon issue
  const defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // Coordinates sync: manual input updates map center
  React.useEffect(() => {
    const lat = parseFloat(geoLat);
    const lng = parseFloat(geoLng);
    if (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  }, [geoLat, geoLng]);

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        setError(`Photo ${file.name} exceeds 5MB limit.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setLandPhotos((prev) => [...prev, base64]);
        setPhotoPreviews((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setLandPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const municipalities = province
    ? localityData.provinces.find((p) => p.name === province)?.municipalities ||
      []
    : [];

  const fetchApprovedApplicants = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "applications"),
        where("status", "==", "forwarded_to_surveyor"),
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
        const submittedAt = data.submittedAt || "";
        if (!encodedIds.has(d.id)) {
          list.push({
            id: d.id,
            userId: data.userId,
            userName: data.userName || "Unknown",
            userMunicipality: data.userMunicipality || "",
            userBarangay: data.userBarangay || "",
            userProvince: data.userProvince || "Negros Occidental",
            submittedAt, // keep for sorting
          });
        }
      });

      // Sort client-side (newest first)
      list.sort((a, b) =>
        (b.submittedAt || "").localeCompare(a.submittedAt || ""),
      );

      setAllApplicants(list);
      setTotalCount(list.length);
      setPage(0);
      setApprovedApplicants(list.slice(0, PAGE_SIZE));
      setHasMore(list.length > PAGE_SIZE);
      if (list.length > 0) {
        setSelectedAppId(list[0].id);
      }
    } catch (err) {
      console.error(
        "Failed to load applications — check Firestore index:",
        err,
      );
      setError(
        "Failed to load applications. If this persists, contact your admin to check Firestore indexes.",
      );
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
    setApprovedApplicants(
      allApplicants.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE),
    );
    setHasMore(true);
  };

  const handleNextPage = () => {
    const newPage = page + 1;
    if (newPage * PAGE_SIZE >= allApplicants.length) return;
    setPage(newPage);
    setApprovedApplicants(
      allApplicants.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE),
    );
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

      const selectedAppRecord = allApplicants.find(
        (a) => a.id === selectedAppId,
      );
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
        landPhotos: landPhotos, // base64 photo array
      });

      const appDocRef = doc(db, "applications", selectedAppRecord.id);
      await updateDoc(appDocRef, {
        status: "verified",
        surveyorEncodedAt: new Date().toISOString(),
        surveyorName: profile?.name || "Surveyor Officer",
        titleNumber: cleanTitle,
      });

      // Write audit log
      await addDoc(collection(db, "auditLogs"), {
        applicationId: selectedAppRecord.id,
        timestamp: new Date().toISOString(),
        actor: profile?.name || "Surveyor",
        actorRole: "surveyor",
        action: "land_encoded",
        oldStatus: "forwarded_to_surveyor",
        newStatus: "verified",
        notes: `Land title ${cleanTitle} encoded — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
      });

      setSubmitted(true);
      setSubmittedTitle(cleanTitle);

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
              Applications forwarded by staff for surveyor processing. Encode
              land parcel details here — they will then be routed for Admin
              approval.
            </p>

            {submitted && (
              <div className="mb-6 rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-sm text-emerald-800">
                <div className="flex items-start space-x-2.5">
                  <FileCheck size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Title {submittedTitle} — Registered &amp; Locked!
                    </span>
                    <span className="text-xs text-emerald-700 mt-1 block">
                      The land title has been encoded and is now queued for
                      Admin approval. The beneficiary can see the update.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setSubmittedTitle("");
                      setTitleNumber("");
                      setLotNumber("");
                      setAreaHectares("");
                      setGeoLat("");
                      setGeoLng("");
                      setProvince("");
                      setMunicipality("");
                      setLandPhotos([]);
                      setPhotoPreviews([]);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-900 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Encode Another Title</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/search?q=${encodeURIComponent(submittedTitle)}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 py-2 px-4 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    <span>View in Search Registry</span>
                  </button>
                </div>
              </div>
            )}

            {errorVisible && (
              <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-500">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span className="font-semibold">{errorVisible}</span>
              </div>
            )}

            {loading && allApplicants.length === 0 && !submitted ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                Scanning eligible applications...
              </div>
            ) : allApplicants.length === 0 && !submitted ? (
              <div className="py-8 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 italic text-xs bg-slate-50/40">
                No applications have been forwarded for surveyor processing yet.
                Staff must forward applications from the review stage first.
              </div>
            ) : submitted ? null : (
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
                      const appProvince =
                        appItem.userProvince || "Negros Occidental";
                      return (
                        <option key={appItem.id} value={appItem.id}>
                          {appItem.userName} ({appItem.userBarangay},{" "}
                          {appProvince}) - ID: {appItem.id}
                        </option>
                      );
                    })}
                  </select>
                  {totalCount > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                      <span>
                        Showing {applicants.length} of {totalCount} applicants
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handlePrevPage}
                          disabled={page === 0}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="font-semibold">
                          Page {page + 1} of {totalPages}
                        </span>
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
                        onChange={(e) => {
                          setProvince(e.target.value);
                          setMunicipality("");
                        }}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold appearance-none"
                      >
                        <option value="">-- Select Province --</option>
                        {localityData.provinces.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
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
                        <option value="">
                          {province
                            ? "-- Choose Municipality --"
                            : "Select province first"}
                        </option>
                        {municipalities.map((m) => (
                          <option key={m.code} value={m.name}>
                            {m.name}
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

                {/* Interactive Map */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-600 flex items-center space-x-1.5 mb-3">
                    <Map size={16} className="text-emerald-800" />
                    <span>Pin Land Location on Map</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-auto">
                      Click map to drop pin / type coordinates above
                    </span>
                  </div>
                  <div className="h-72 rounded-xl overflow-hidden border border-slate-200">
                    <MapContainer
                      center={mapCenter}
                      zoom={mapZoom}
                      style={{ height: "100%", width: "100%" }}
                      scrollWheelZoom={true}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapClickHandler
                        onPinDrop={(lat, lng) => {
                          setGeoLat(lat.toFixed(6));
                          setGeoLng(lng.toFixed(6));
                          setMapCenter([lat, lng]);
                          setMapZoom(16);
                        }}
                      />
                      <MapCenterUpdater center={mapCenter} zoom={mapZoom} />
                      {parseFloat(geoLat) && parseFloat(geoLng) && (
                        <Marker
                          position={[parseFloat(geoLat), parseFloat(geoLng)]}
                          icon={defaultIcon}
                        />
                      )}
                    </MapContainer>
                  </div>
                </div>

                {/* Land Photos Upload */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-600 flex items-center space-x-1.5 mb-3">
                    <Camera size={16} className="text-emerald-800" />
                    <span>Land Photos (Optional)</span>
                  </div>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl py-4 cursor-pointer hover:bg-white transition-colors">
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-xs text-slate-500">
                      Upload land photos (JPG, PNG)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                      {photoPreviews.map((src, i) => (
                        <div
                          key={i}
                          className="relative group rounded-lg overflow-hidden border border-slate-200 h-24"
                        >
                          <img
                            src={src}
                            className="h-full w-full object-cover"
                            alt={`Land photo ${i + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

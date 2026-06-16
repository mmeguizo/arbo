import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { uploadFile, getLandPhotoPath } from "../utils/storage";
import {
  collection,
  getDocs,
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
  Layers,
  Map,
  Compass,
  FileCheck,
  Globe,
  Camera,
  Upload,
  Edit,
  PlusCircle,
  Trash2,
  Lock,
  X,
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

interface ExistingTitle {
  titleId: string;
  applicationId: string | null;
  beneficiaryId: string | null;
  beneficiaryName: string | null;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  province: string;
  municipality: string;
  geoLat: string;
  geoLng: string;
  encoderId: string;
  encodedAt: string;
  landPhotos?: string[];
  internalStatus?: string;
  internalNotes?: string;
  status?: string; // "unassigned" | "assigned" | "awarded"
  titleType?: string; // "tct" | "cloa" | "cloa-tct"
  cloaType?: string | null; // "split" | "field_survey"
  aspPsdNumber?: string; // ASP / PSD number
}

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
  const [allTitles, setAllTitles] = useState<ExistingTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form Fields
  const [lotNumber, setLotNumber] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [existingTitleId, setExistingTitleId] = useState<string | null>(null);

  // Map & photo state
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    10.2831, 122.9912,
  ]);
  const [mapZoom, setMapZoom] = useState(10);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [errorVisible, setError] = useState<string | null>(null);

  const defaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

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

  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        setError(`Photo ${file.name} exceeds 10MB limit.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreviews((prev) => [...prev, previewUrl]);
      setPendingPhotoFiles((prev) => [...prev, file]);
    }
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setPendingPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    const previewUrl = photoPreviews[idx];
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const municipalities = province
    ? localityData.provinces.find((p) => p.name === province)?.municipalities ||
      []
    : [];

  // Reset form
  const resetForm = () => {
    setLotNumber("");
    setAreaHectares("");
    setGeoLat("");
    setGeoLng("");
    setProvince("");
    setMunicipality("");
    setPendingPhotoFiles([]);
    setPhotoPreviews([]);
    setIsEditing(false);
    setExistingTitleId(null);
    setError(null);
  };

  const fetchAllTitles = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "landTitles"));
      const list: ExistingTitle[] = [];
      snap.forEach((d) => {
        const data = d.data() as ExistingTitle;
        if (data.status !== "deleted") {
          list.push({ ...data, titleId: d.id } as ExistingTitle);
        }
      });
      list.sort((a, b) => (b.encodedAt || "").localeCompare(a.encodedAt || ""));
      setAllTitles(list);
    } catch (err) {
      console.error("Failed to load titles:", err);
      setError("Failed to load land titles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTitles();
  }, []);

  // Open form for editing an existing title
  const handleEdit = (title: ExistingTitle) => {
    if (title.status === "awarded") return; // Guard: can't edit awarded
    setLotNumber(title.lotNumber || "");
    setAreaHectares(String(title.areaHectares || ""));
    setGeoLat(title.geoLat || "");
    setGeoLng(title.geoLng || "");
    setProvince(title.province || "");
    setMunicipality(title.municipality || "");
    if (title.landPhotos && title.landPhotos.length > 0) {
      setPhotoPreviews([...title.landPhotos]);
    }
    setIsEditing(true);
    setExistingTitleId(title.titleId);
    setSubmitted(false);
    setShowForm(true);
  };

  // Soft delete a title
  const handleDelete = async (titleId: string) => {
    const title = allTitles.find((t) => t.titleId === titleId);
    if (!title || title.status === "awarded") return;
    try {
      setLoading(true);
      const titleRef = doc(db, "landTitles", titleId);
      await updateDoc(titleRef, { status: "deleted" });
      await addDoc(collection(db, "auditLogs"), {
        applicationId: null,
        timestamp: new Date().toISOString(),
        actor: profile?.name || "Encoder",
        actorRole: "encoder",
        action: "title_deleted",
        oldStatus: title.status || "unassigned",
        newStatus: "deleted",
        notes: `Encoder deleted title ${title.titleNumber}`,
      });
      setAllTitles((prev) => prev.filter((t) => t.titleId !== titleId));
    } catch (err) {
      console.error("Failed to delete title:", err);
    } finally {
      setLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitted(false);

    if (
      !lotNumber ||
      !areaHectares ||
      !geoLat ||
      !geoLng ||
      !province ||
      !municipality
    ) {
      setError("Please complete all required survey fields.");
      return;
    }

    try {
      setLoading(true);

      // Upload land photos
      const photoUrls: string[] = [];
      if (isEditing && photoPreviews.length > 0) {
        const existingUrls = photoPreviews.filter(
          (p) => !p.startsWith("blob:"),
        );
        photoUrls.push(...existingUrls);
      }

      for (let i = 0; i < pendingPhotoFiles.length; i++) {
        const photoFile = pendingPhotoFiles[i];
        try {
          const titleRef = existingTitleId || `TTL-${Date.now()}`;
          const photoPath = getLandPhotoPath(titleRef, photoUrls.length + i);
          const photoUrl = await uploadFile(photoFile, photoPath);
          photoUrls.push(photoUrl);
        } catch (uploadErr) {
          console.error(`Failed to upload photo ${i}:`, uploadErr);
        }
      }

      if (isEditing && existingTitleId) {
        // Update existing title
        const titleRef = doc(db, "landTitles", existingTitleId);
        await updateDoc(titleRef, {
          lotNumber: lotNumber.trim(),
          areaHectares: Number(areaHectares),
          province,
          municipality,
          geoLat: geoLat.trim(),
          geoLng: geoLng.trim(),
          encoderId: profile?.name || "Encoder Officer",
          encodedAt: new Date().toISOString(),
          ...(photoUrls.length > 0 ? { landPhotos: photoUrls } : {}),
        });

        await addDoc(collection(db, "auditLogs"), {
          applicationId: null,
          timestamp: new Date().toISOString(),
          actor: profile?.name || "Encoder",
          actorRole: "encoder",
          action: "survey_updated",
          oldStatus: "unassigned",
          newStatus: "unassigned",
          notes: `Updated survey — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
        });
      } else {
        // Create new survey
        const generatedTitleId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;

        await setDoc(doc(db, "landTitles", generatedTitleId), {
          titleId: generatedTitleId,
          applicationId: null,
          beneficiaryId: null,
          beneficiaryName: null,
          titleNumber: null,
          titleType: null,
          cloaType: null,
          lotNumber: lotNumber.trim(),
          areaHectares: Number(areaHectares),
          province,
          municipality,
          geoLat: geoLat.trim(),
          geoLng: geoLng.trim(),
          encoderId: profile?.name || "Encoder Officer",
          encodedAt: new Date().toISOString(),
          landPhotos: photoUrls,
          status: "unassigned",
        });

        await addDoc(collection(db, "auditLogs"), {
          applicationId: null,
          timestamp: new Date().toISOString(),
          actor: profile?.name || "Encoder",
          actorRole: "encoder",
          action: "survey_created",
          oldStatus: null,
          newStatus: "unassigned",
          notes: `Encoded new survey — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
        });
      }

      setSubmittedTitle(lotNumber);
      setSubmitted(true);
      await fetchAllTitles();
    } catch (err) {
      console.error("Failed to save land title:", err);
      const firebaseErr = err as { code?: string; message?: string };
      setError(`Failed to save: ${firebaseErr.message || "Unexpected error."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              DAR Encoder Office
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              Land Survey Entry Dashboard
            </h1>
          </div>
        </header>

        <main className="p-8 max-w-6xl space-y-6">
          {/* Header with Add Button */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
                DAR Encoder Office
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
                Land Survey Registry
              </h1>
            </div>
            <button
              onClick={() => {
                resetForm();
                setSubmitted(false);
                setShowForm(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-3 px-5 text-sm font-semibold transition-all shadow-md cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>Add New Survey</span>
            </button>
          </div>

          {/* Title Registry Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {loading && allTitles.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent mx-auto mb-2"></div>
                Loading registry...
              </div>
            ) : allTitles.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl m-4 text-slate-400 italic text-xs">
                No land surveys registered yet. Click "Add New Survey" to encode
                your first survey record.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider">
                        Lot #
                      </th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider">
                        Area (ha)
                      </th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider">
                        Municipality
                      </th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTitles.map((t) => {
                      const isAwarded = t.status === "awarded";
                      return (
                        <tr
                          key={t.titleId}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-3 text-slate-700 font-semibold">
                            {t.lotNumber}
                          </td>
                          <td className="px-6 py-3 text-emerald-800 font-bold">
                            {t.areaHectares}
                          </td>
                          <td className="px-6 py-3 text-slate-600">
                            {t.municipality}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.status === "awarded" ? "bg-blue-50 text-blue-700 border-blue-200" : t.status === "assigned" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                            >
                              {t.status === "awarded"
                                ? "Awarded"
                                : t.status === "assigned"
                                  ? "Assigned"
                                  : "Unassigned"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isAwarded ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-bold px-2 py-1"
                                  title="Cannot modify awarded titles"
                                >
                                  <Lock size={12} />
                                  Locked
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEdit(t)}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer"
                                    title="Edit title"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteId(t.titleId)
                                    }
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
                                    title="Delete title"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {confirmDeleteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-left space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Delete Survey?
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      This will soft-delete the survey record. It can still be
                      found in the audit trail for compliance purposes.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    disabled={loading}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Form Modal — fixed overlay, fully outside page layout */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4 md:p-8">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 text-left my-4 relative">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {isEditing ? "Edit Survey" : "New Survey"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                      setSubmitted(false);
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {submitted && (
                  <div className="mb-6 rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-sm text-emerald-800">
                    <div className="flex items-start space-x-2.5">
                      <FileCheck size={20} className="shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          Survey {submittedTitle} —{" "}
                          {isEditing ? "Updated!" : "Saved!"}
                        </span>
                        <span className="text-xs text-emerald-700 mt-1 block">
                          The survey record has been saved and is available for
                          staff assignment.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {errorVisible && (
                  <div className="mb-6 flex items-start space-x-2.5 rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-500">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span className="font-semibold">{errorVisible}</span>
                  </div>
                )}

                {!submitted && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                        <span>
                          Exact Boundaries Geographic Coordinates (GPS)
                        </span>
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
                              position={[
                                parseFloat(geoLat),
                                parseFloat(geoLng),
                              ]}
                              icon={defaultIcon}
                            />
                          )}
                        </MapContainer>
                      </div>
                    </div>

                    {/* Land Photos */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-600 flex items-center space-x-1.5 mb-3">
                        <Camera size={16} className="text-emerald-800" />
                        <span>Land Photos</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Upload photos of the surveyed land
                        </span>
                      </div>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-3">
                        {photoPreviews.map((src, i) => (
                          <div
                            key={i}
                            className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white"
                          >
                            <img
                              src={src}
                              alt={`Land photo ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-[8px] cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
                          <Upload size={16} className="text-slate-400" />
                          <span className="text-[8px] font-bold text-slate-400">
                            Add Photo
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-950 text-white py-3.5 px-6 text-sm font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <Check size={16} />
                      )}
                      <span>{isEditing ? "Update Survey" : "Save Survey"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

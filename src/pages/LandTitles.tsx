import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { broadcastNotification } from "../contexts/NotificationContext";
import { Sidebar } from "../components/Sidebar";
import { uploadFile, getLandPhotoPath } from "../utils/storage";
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
  ChevronDown,
  Camera,
  Upload,
  ExternalLink,
  RotateCcw,
  Search,
  Edit,
  PlusCircle,
  UserCheck,
  Landmark,
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
  surveyorId: string;
  encodedAt: string;
  landPhotos?: string[];
  internalStatus?: string;
  internalNotes?: string;
  status?: string; // "unassigned" | "assigned" | "awarded"
}

const PAGE_SIZE = 20;

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

const SearchableBeneficiarySelect: React.FC<{
  applicants: ApprovedApplicant[];
  selectedAppId: string;
  onSelect: (id: string) => void;
  totalCount: number;
  placeholder?: string;
}> = ({
  applicants,
  selectedAppId,
  onSelect,
  totalCount,
  placeholder = "Search beneficiary name, barangay, or ID...",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = applicants.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.userName.toLowerCase().includes(q) ||
      a.userBarangay.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.userProvince || "").toLowerCase().includes(q)
    );
  });

  const selected = applicants.find((a) => a.id === selectedAppId);

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={
            open
              ? search
              : selected
                ? `${selected.userName} (${selected.userBarangay}) - ID: ${selected.id}`
                : ""
          }
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-semibold"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
              No matches found.
            </div>
          ) : (
            filtered.map((appItem) => {
              const appProvince = appItem.userProvince || "Negros Occidental";
              const isSelected = appItem.id === selectedAppId;
              return (
                <button
                  key={appItem.id}
                  type="button"
                  onClick={() => {
                    onSelect(appItem.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-bold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-semibold">{appItem.userName}</span>
                  <span className="text-slate-400 ml-1">
                    ({appItem.userBarangay}, {appProvince})
                  </span>
                  <span className="text-[9px] text-slate-400 ml-2 font-mono">
                    ID: {appItem.id}
                  </span>
                </button>
              );
            })
          )}
          {totalCount > filtered.length && (
            <div className="px-4 py-2 text-[9px] text-slate-400 bg-slate-50 border-t border-slate-100 text-center">
              {filtered.length} of {totalCount} shown
            </div>
          )}
        </div>
      )}
    </div>
  );
};

type ActiveMode = "assign" | "unassigned";

export const LandTitles: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<ActiveMode>("assign");
  const [applicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState("");

  const [allApplicants, setAllApplicants] = useState<ApprovedApplicant[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Form Fields (shared)
  const [selectedAppId, setSelectedAppId] = useState("");
  const [titleNumber, setTitleNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [province, setProvince] = useState("");
  const [municipality, setMunicipality] = useState("");

  // Correction/Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [existingTitleId, setExistingTitleId] = useState<string | null>(null);
  const [correctionApp, setCorrectionApp] = useState<{
    internalStatus?: string;
    internalNotes?: string;
  } | null>(null);

  // Assign-existing-title state
  const [showAssignExisting, setShowAssignExisting] = useState(false);
  const [unassignedTitles, setUnassignedTitles] = useState<ExistingTitle[]>([]);
  const [assignExistingTitleId, setAssignExistingTitleId] = useState<
    string | null
  >(null);

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
    setSelectedAppId("");
    setTitleNumber("");
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
    setCorrectionApp(null);
    setShowAssignExisting(false);
    setAssignExistingTitleId(null);
    setError(null);
  };

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
      const existingTitles: Record<string, ExistingTitle> = {};
      titleSnap.forEach((d) => {
        const data = d.data() as ExistingTitle;
        if (data.applicationId) {
          encodedIds.add(data.applicationId);
          existingTitles[data.applicationId] = { ...data, titleId: d.id };
        }
      });

      const list: ApprovedApplicant[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const submittedAt = data.submittedAt || "";
        const internalStatus = data.internalStatus || "";
        if (!encodedIds.has(d.id) || internalStatus === "correction_surveyor") {
          list.push({
            id: d.id,
            userId: data.userId,
            userName: data.userName || "Unknown",
            userMunicipality: data.userMunicipality || "",
            userBarangay: data.userBarangay || "",
            userProvince: data.userProvince || "Negros Occidental",
            submittedAt,
          });
        }
      });

      list.sort((a, b) =>
        (b.submittedAt || "").localeCompare(a.submittedAt || ""),
      );

      setAllApplicants(list);
      setTotalCount(list.length);
      setApprovedApplicants(list.slice(0, PAGE_SIZE));

      if (list.length > 0 && activeMode === "assign") {
        const firstId = list[0].id;
        setSelectedAppId(firstId);
        if (existingTitles[firstId]) {
          const ext = existingTitles[firstId];
          setTitleNumber(ext.titleNumber || "");
          setLotNumber(ext.lotNumber || "");
          setAreaHectares(String(ext.areaHectares || ""));
          setGeoLat(ext.geoLat || "");
          setGeoLng(ext.geoLng || "");
          setProvince(ext.province || "");
          setMunicipality(ext.municipality || "");
          if (ext.landPhotos && ext.landPhotos.length > 0) {
            setPhotoPreviews(ext.landPhotos);
          }
          setIsEditing(true);
          setExistingTitleId(ext.titleId);
        }
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
      setError(
        "Failed to load applications. If this persists, contact your admin to check Firestore indexes.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch unassigned titles for assign-existing dropdown
  const fetchUnassignedTitles = async () => {
    try {
      const q = query(
        collection(db, "landTitles"),
        where("status", "==", "unassigned"),
      );
      const snap = await getDocs(q);
      const list: ExistingTitle[] = [];
      snap.forEach((d) => {
        list.push({ titleId: d.id, ...d.data() } as ExistingTitle);
      });
      setUnassignedTitles(list);
    } catch (err) {
      console.error("Failed to load unassigned titles:", err);
    }
  };

  useEffect(() => {
    fetchApprovedApplicants();
    fetchUnassignedTitles();
  }, [activeMode]);

  // Handle assigning an existing unassigned title
  const handleAssignExisting = async (titleId: string) => {
    const title = unassignedTitles.find((t) => t.titleId === titleId);
    if (!title) return;
    setAssignExistingTitleId(titleId);
    // Pre-fill form with existing title data
    setTitleNumber(title.titleNumber || "");
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
    setExistingTitleId(titleId);
  };

  // When selecting an app, check if we need to enter edit mode
  const handleSelectApp = async (appId: string) => {
    setSelectedAppId(appId);
    resetForm();
    setAssignExistingTitleId(null);
    setPhotoPreviews([]);

    // Look up existing land title for this app
    try {
      const titleSnap = await getDocs(collection(db, "landTitles"));
      let foundTitleId: string | null = null;
      const existingRows: Record<string, string> = {};
      titleSnap.forEach((d) => {
        const data = d.data() as ExistingTitle;
        if (data.applicationId === appId) {
          foundTitleId = d.id;
          existingRows.titleNumber = data.titleNumber || "";
          existingRows.lotNumber = data.lotNumber || "";
          existingRows.areaHectares = String(data.areaHectares || "");
          existingRows.geoLat = data.geoLat || "";
          existingRows.geoLng = data.geoLng || "";
          existingRows.province = data.province || "";
          existingRows.municipality = data.municipality || "";
          if (data.landPhotos && data.landPhotos.length > 0) {
            setPhotoPreviews([...data.landPhotos]);
          }
        }
      });

      const { getDoc: gd } = await import("firebase/firestore");
      const appDoc = await gd(doc(db, "applications", appId));
      const appData = appDoc.data();
      if (appData?.internalStatus === "correction_surveyor") {
        setCorrectionApp({
          internalStatus: appData.internalStatus,
          internalNotes: appData.internalNotes || "",
        });
      }

      if (foundTitleId) {
        setTitleNumber(existingRows.titleNumber || "");
        setLotNumber(existingRows.lotNumber || "");
        setAreaHectares(existingRows.areaHectares || "");
        setGeoLat(existingRows.geoLat || "");
        setGeoLng(existingRows.geoLng || "");
        setProvince(existingRows.province || "");
        setMunicipality(existingRows.municipality || "");
        setIsEditing(true);
        setExistingTitleId(foundTitleId);
      }
    } catch (err) {
      console.error("Failed to check existing title:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitted(false);

    if (
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

    // For beneficiary mode, require beneficiary
    if (activeMode === "assign" && !selectedAppId && !assignExistingTitleId) {
      setError("Please select a beneficiary to assign this title to.");
      return;
    }

    const cleanTitle = titleNumber.trim().toUpperCase();

    try {
      setLoading(true);

      // Duplicate check (skip for edits)
      if (!isEditing) {
        const allTitlesSnap = await getDocs(collection(db, "landTitles"));
        const isDuplicate = allTitlesSnap.docs.some(
          (d) =>
            d.data().titleNumber?.toUpperCase() === cleanTitle &&
            d.id !== existingTitleId,
        );
        if (isDuplicate) {
          setError(
            `CRITICAL WARNING: The Land Title ID: '${cleanTitle}' is already registered in our database!`,
          );
          setLoading(false);
          return;
        }
      }

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

      // === UNASSIGNED MODE ===
      if (activeMode === "unassigned") {
        if (isEditing && existingTitleId) {
          const titleRef = doc(db, "landTitles", existingTitleId);
          await updateDoc(titleRef, {
            titleNumber: cleanTitle,
            lotNumber: lotNumber.trim(),
            areaHectares: Number(areaHectares),
            province,
            municipality,
            geoLat: geoLat.trim(),
            geoLng: geoLng.trim(),
            surveyorId: profile?.name || "Surveyor Officer",
            encodedAt: new Date().toISOString(),
            ...(photoUrls.length > 0 ? { landPhotos: photoUrls } : {}),
          });

          await addDoc(collection(db, "auditLogs"), {
            applicationId: null,
            timestamp: new Date().toISOString(),
            actor: profile?.name || "Surveyor",
            actorRole: "surveyor",
            action: "unassigned_title_updated",
            oldStatus: "unassigned",
            newStatus: "unassigned",
            notes: `Updated unassigned title ${cleanTitle} — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
          });
        } else {
          const generatedTitleId = `TTL-${Math.floor(100000 + Math.random() * 900000)}`;

          await setDoc(doc(db, "landTitles", generatedTitleId), {
            titleId: generatedTitleId,
            applicationId: null,
            beneficiaryId: null,
            beneficiaryName: null,
            titleNumber: cleanTitle,
            lotNumber: lotNumber.trim(),
            areaHectares: Number(areaHectares),
            province,
            municipality,
            geoLat: geoLat.trim(),
            geoLng: geoLng.trim(),
            surveyorId: profile?.name || "Surveyor Officer",
            encodedAt: new Date().toISOString(),
            landPhotos: photoUrls,
            status: "unassigned",
          });

          await addDoc(collection(db, "auditLogs"), {
            applicationId: null,
            timestamp: new Date().toISOString(),
            actor: profile?.name || "Surveyor",
            actorRole: "surveyor",
            action: "unassigned_title_created",
            oldStatus: null,
            newStatus: "unassigned",
            notes: `Surveyed unassigned land title ${cleanTitle} — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
          });
        }

        setSubmittedTitle(cleanTitle);
        setSubmitted(true);
      }
      // === ASSIGN (BENEFICIARY) MODE ===
      else {
        // If assigning an existing unassigned title
        if (assignExistingTitleId) {
          const selectedAppRecord = allApplicants.find(
            (a) => a.id === selectedAppId,
          );
          if (!selectedAppRecord) {
            setError("Invalid applicant selected.");
            setLoading(false);
            return;
          }

          const titleRef = doc(db, "landTitles", assignExistingTitleId);
          await updateDoc(titleRef, {
            applicationId: selectedAppRecord.id,
            beneficiaryId: selectedAppRecord.userId,
            beneficiaryName: selectedAppRecord.userName,
            titleNumber: cleanTitle,
            lotNumber: lotNumber.trim(),
            areaHectares: Number(areaHectares),
            province,
            municipality,
            geoLat: geoLat.trim(),
            geoLng: geoLng.trim(),
            surveyorId: profile?.name || "Surveyor Officer",
            encodedAt: new Date().toISOString(),
            status: "assigned",
            ...(photoUrls.length > 0 ? { landPhotos: photoUrls } : {}),
          });

          const appDocRef = doc(db, "applications", selectedAppRecord.id);
          await updateDoc(appDocRef, {
            status: "verified",
            internalStatus: "ok",
            internalNotes: "",
            internalAssignedTo: null,
            internalAssignedRole: null,
            surveyorEncodedAt: new Date().toISOString(),
            surveyorName: profile?.name || "Surveyor Officer",
            titleNumber: cleanTitle,
          });

          await addDoc(collection(db, "auditLogs"), {
            applicationId: selectedAppRecord.id,
            timestamp: new Date().toISOString(),
            actor: profile?.name || "Surveyor",
            actorRole: "surveyor",
            action: "title_assigned",
            oldStatus: "unassigned",
            newStatus: "verified",
            notes: `Assigned unassigned title ${cleanTitle} to ${selectedAppRecord.userName}`,
          });

          await broadcastNotification(
            "admin",
            "encoded",
            "Land Title Assigned — Ready for Admin Review",
            `Surveyor ${profile?.name} assigned title ${cleanTitle} to ${selectedAppRecord.userName} (${selectedAppRecord.id}).`,
            selectedAppRecord.id,
          );

          setSubmittedTitle(cleanTitle);
          setSubmitted(true);
        }
        // Editing existing assigned title (correction)
        else if (isEditing && existingTitleId) {
          const titleRef = doc(db, "landTitles", existingTitleId);
          await updateDoc(titleRef, {
            titleNumber: cleanTitle,
            lotNumber: lotNumber.trim(),
            areaHectares: Number(areaHectares),
            province,
            municipality,
            geoLat: geoLat.trim(),
            geoLng: geoLng.trim(),
            surveyorId: profile?.name || "Surveyor Officer",
            encodedAt: new Date().toISOString(),
            ...(photoUrls.length > 0 ? { landPhotos: photoUrls } : {}),
          });

          const selectedAppRecord = allApplicants.find(
            (a) => a.id === selectedAppId,
          );
          if (selectedAppRecord) {
            const appDocRef = doc(db, "applications", selectedAppRecord.id);
            await updateDoc(appDocRef, {
              status: "verified",
              internalStatus: "ok",
              internalNotes: "",
              internalAssignedTo: null,
              internalAssignedRole: null,
              surveyorEncodedAt: new Date().toISOString(),
              surveyorName: profile?.name || "Surveyor Officer",
              titleNumber: cleanTitle,
            });
          }

          await addDoc(collection(db, "auditLogs"), {
            applicationId: selectedAppRecord?.id || null,
            timestamp: new Date().toISOString(),
            actor: profile?.name || "Surveyor",
            actorRole: "surveyor",
            action: "land_edited",
            oldStatus: "forwarded_to_surveyor",
            newStatus: "verified",
            notes: `Land title ${cleanTitle} corrected — ${areaHectares}ha, Lot ${lotNumber}, ${municipality}`,
          });

          await broadcastNotification(
            "admin",
            "correction_resolved",
            "Land Title Correction Resolved",
            `Surveyor ${profile?.name} corrected title ${cleanTitle} for ${selectedAppRecord?.userName || "beneficiary"}. Ready for admin review.`,
            selectedAppRecord?.id || null,
          );

          setSubmittedTitle(cleanTitle);
          setSubmitted(true);
        }
        // Create new assigned title
        else {
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
            province,
            municipality,
            geoLat: geoLat.trim(),
            geoLng: geoLng.trim(),
            surveyorId: profile?.name || "Surveyor Officer",
            encodedAt: new Date().toISOString(),
            landPhotos: photoUrls,
            status: "assigned",
          });

          const appDocRef = doc(db, "applications", selectedAppRecord.id);
          await updateDoc(appDocRef, {
            status: "verified",
            surveyorEncodedAt: new Date().toISOString(),
            surveyorName: profile?.name || "Surveyor Officer",
            titleNumber: cleanTitle,
          });

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

          await broadcastNotification(
            "admin",
            "encoded",
            "Land Title Encoded — Ready for Admin Approval",
            `Surveyor ${profile?.name} encoded title ${cleanTitle} for ${selectedAppRecord.userName} (${selectedAppRecord.id}).`,
          );

          setSubmittedTitle(cleanTitle);
          setSubmitted(true);
        }
      }

      await fetchApprovedApplicants();
      await fetchUnassignedTitles();
    } catch (err) {
      console.error("Failed to save land title:", err);
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === "permission-denied") {
        setError(
          "Permission denied. Your account may not have write access. Contact your admin.",
        );
      } else {
        setError(
          `Failed to save: ${firebaseErr.message || "Unexpected error. Please try again."}`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

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
          {/* Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveMode("assign");
                resetForm();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activeMode === "assign"
                  ? "bg-emerald-800 text-white border-emerald-800 shadow-md"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <UserCheck size={14} />
              Assign to Beneficiary
            </button>
            <button
              onClick={() => {
                setActiveMode("unassigned");
                resetForm();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activeMode === "unassigned"
                  ? "bg-emerald-800 text-white border-emerald-800 shadow-md"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Landmark size={14} />
              Unassigned Survey
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              {activeMode === "assign"
                ? isEditing
                  ? "Edit & Correct Land Parcel"
                  : assignExistingTitleId
                    ? "Assign Existing Land Title"
                    : "Encode New Verified Land Parcel"
                : isEditing
                  ? "Edit Unassigned Survey"
                  : "New Unassigned Land Survey"}
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              {activeMode === "assign"
                ? isEditing
                  ? "Update the land title fields as needed and resubmit."
                  : assignExistingTitleId
                    ? "Assign a previously surveyed unassigned land title to this beneficiary."
                    : "Select a beneficiary application forwarded by staff. Encode land parcel details here — they will then be routed for Admin approval."
                : isEditing
                  ? "Update the unassigned land survey data."
                  : "Survey a new land parcel without assigning a beneficiary yet. Fill in all geographic details and upload photos. The title will be stored as unassigned and available for later assignment."}
            </p>

            {submitted && (
              <div className="mb-6 rounded-xl bg-emerald-50 p-5 border border-emerald-200 text-sm text-emerald-800">
                <div className="flex items-start space-x-2.5">
                  <FileCheck size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Title {submittedTitle} —{" "}
                      {activeMode === "unassigned"
                        ? "Surveyed & Saved!"
                        : isEditing
                          ? "Corrected & Updated!"
                          : assignExistingTitleId
                            ? "Assigned & Locked!"
                            : "Registered & Locked!"}
                    </span>
                    <span className="text-xs text-emerald-700 mt-1 block">
                      {activeMode === "unassigned"
                        ? "The unassigned land title has been saved and can be assigned to a beneficiary later."
                        : "The land title has been encoded and is now queued for Admin approval."}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setSubmittedTitle("");
                      resetForm();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-900 text-white py-2 px-4 text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>
                      {activeMode === "unassigned"
                        ? "Survey Another"
                        : "Encode Another Title"}
                    </span>
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

            {correctionApp && correctionApp.internalNotes && (
              <div className="mb-6 rounded-xl bg-red-50 p-5 border border-red-200 text-sm text-red-700">
                <div className="flex items-start space-x-2.5">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Admin Correction Request
                    </span>
                    <p className="text-xs mt-1 leading-relaxed">
                      {correctionApp.internalNotes}
                    </p>
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

            {loading && allApplicants.length === 0 && !submitted ? (
              <div className="py-8 text-center text-slate-400 italic text-xs">
                Scanning records...
              </div>
            ) : activeMode === "assign" &&
              allApplicants.length === 0 &&
              !submitted ? (
              <div className="py-8 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 italic text-xs bg-slate-50/40">
                No applications have been forwarded for surveyor processing yet.
                Staff must forward applications from the review stage first.
              </div>
            ) : submitted ? null : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Beneficiary select — only in assign mode */}
                {activeMode === "assign" && (
                  <>
                    <div className="relative">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                        Select Beneficiary
                      </label>
                      <SearchableBeneficiarySelect
                        applicants={
                          allApplicants.length > 0 ? allApplicants : applicants
                        }
                        selectedAppId={selectedAppId}
                        onSelect={handleSelectApp}
                        totalCount={totalCount}
                      />
                      {(isEditing || assignExistingTitleId) && (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                          <Edit size={10} />
                          {assignExistingTitleId
                            ? "Assigning existing title"
                            : "Editing existing title"}
                        </span>
                      )}
                    </div>

                    {/* Assign Existing Title Collapsible */}
                    {!assignExistingTitleId && !isEditing && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAssignExisting(!showAssignExisting);
                            if (!showAssignExisting) fetchUnassignedTitles();
                          }}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                        >
                          <PlusCircle size={12} />
                          {showAssignExisting
                            ? "Hide"
                            : "Or assign an existing unassigned land title..."}
                        </button>
                        {showAssignExisting && (
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-[10px] text-amber-700 mb-2 font-semibold">
                              Select an unassigned title to assign to the
                              selected beneficiary:
                            </p>
                            {unassignedTitles.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">
                                No unassigned titles available.
                              </p>
                            ) : (
                              <select
                                value={assignExistingTitleId || ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignExisting(e.target.value);
                                  }
                                }}
                                className="w-full rounded-lg border border-amber-300 bg-white py-2 px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="">
                                  -- Select unassigned title --
                                </option>
                                {unassignedTitles.map((t) => (
                                  <option key={t.titleId} value={t.titleId}>
                                    {t.titleNumber} — {t.areaHectares}ha, Lot{" "}
                                    {t.lotNumber}, {t.municipality}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

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
                  <span>
                    {activeMode === "unassigned"
                      ? isEditing
                        ? "Update Unassigned Survey"
                        : "Save Unassigned Survey"
                      : assignExistingTitleId
                        ? "Assign Title to Beneficiary"
                        : isEditing
                          ? "Save & Submit Correction"
                          : "Encode & Submit for Admin Approval"}
                  </span>
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

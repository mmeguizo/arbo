import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sidebar } from "../components/Sidebar";
import { StatusBadge, type ApplicationStatus } from "../components/StatusBadge";
import { collection, query, getDocs, where, limit } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  FileText,
  Map,
  CreditCard,
  Layers,
  MapPin,
  Calendar,
  AlertCircle,
  Hash,
} from "lucide-react";

interface LandTitle {
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  geoLat: string;
  geoLng: string;
  encodedAt: string;
}

interface ApplicationData {
  applicationId: string;
  status: ApplicationStatus;
  submittedAt: string;
  documents: {
    cedula: string | null;
    birthCert: string | null;
    brgyCert: string | null;
    picture: string | null;
  };
  notes: string;
}

export const MyApplication: React.FC = () => {
  const { profile, user } = useAuth();
  const [app, setApp] = useState<ApplicationData | null>(null);
  const [title, setTitle] = useState<LandTitle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplicationInfo = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Fetch user's application
        const q = query(
          collection(db, "applications"),
          where("userId", "==", user.uid),
          limit(1),
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const appDoc = qSnap.docs[0];
          const appData = appDoc.data() as ApplicationData;
          setApp({ ...appData, applicationId: appDoc.id });

          // 2. Fetch associated land title details if app is verified
          const tQ = query(
            collection(db, "landTitles"),
            where("beneficiaryId", "==", user.uid),
            limit(1),
          );
          const tSnap = await getDocs(tQ);
          if (!tSnap.empty) {
            setTitle(tSnap.docs[0].data() as LandTitle);
          }
        }
      } catch (err) {
        console.error("Error fetching applicant info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationInfo();
  }, [user]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="text-left animate-fade-in">
            <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 m-0">
              ARB Area workspace
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 mb-0">
              My CLOA & Title Record
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-800 border-t-transparent"></div>
              <p className="text-xs font-semibold text-slate-500">
                Loading your agrarian file...
              </p>
            </div>
          </div>
        ) : (
          <main className="flex-1 p-8 space-y-8 max-w-5xl">
            {/* Top overview widget */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile card summary */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left lg:col-span-2 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      Resident Beneficiary
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">
                      {profile?.name}
                    </h2>
                    <p className="text-xs text-slate-550 mt-1">
                      {profile?.address}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-emerald-800/10 border border-emerald-100 flex items-center justify-center overflow-hidden">
                    {app?.documents.picture ? (
                      <img
                        src={app.documents.picture}
                        alt="Profile photo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-emerald-800 font-bold uppercase">
                        {profile?.name.substring(0, 2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Age
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.age} years old
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Contact
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.contact}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Barangay
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.barangay}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
                      Registry Date
                    </span>
                    <span className="text-slate-700 font-bold">
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString()
                        : "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Application details card status */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-left flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Application File Status
                  </span>
                  {app ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          ID: {app.applicationId}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed pt-2">
                        {app.status === "under_review" &&
                          "Your application credentials have been successfully uploaded. DAR municipal evaluators are manually checking your files."}
                        {app.status === "pending" &&
                          "Municipal staff has verified your files! Waiting on Admin/Regional Director final confirmation."}
                        {app.status === "verified" &&
                          "Congratulations! Your application is fully approved. The municipal surveyor team is allocating title boundaries."}
                        {app.status === "disputed" &&
                          "There is an issue with your credentials/residency. Please reach out to your municipal officer immediately."}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 italic text-xs">
                      No application record generated yet. Please contact the
                      administrator.
                    </div>
                  )}
                </div>

                {app?.notes && (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-left text-xs text-slate-600">
                    <span className="font-bold text-[10px] text-slate-400 uppercase block mb-1">
                      Evaluator Comments
                    </span>
                    <span>"{app.notes}"</span>
                  </div>
                )}
              </div>
            </div>

            {/* Awarded land title details widget (Renders ONLY if surveyor has encoded title) */}
            {title ? (
              <div className="bg-white rounded-2xl border border-emerald-250 shadow-sm p-6 text-left border-l-8 border-l-emerald-800 space-y-6">
                <div>
                  <span className="text-[10px] uppercase bg-emerald-50 text-emerald-800 border-emerald-200 border px-2.5 py-1 rounded inline-block font-extrabold">
                    Certificate of Land Ownership Award (CLOA)
                  </span>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
                    Awarded Agrarian Land Parcel
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    This is your official title details encoded and verified by
                    the DAR Municipal Surveyor.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 text-sm">
                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Hash size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Title Number (OCT/TCT)
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.titleNumber}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Layers size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Lot / Parcel Number
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.lotNumber}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <Map size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Land Area
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.areaHectares} Hectares
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex items-center space-x-3.5">
                    <MapPin size={20} className="text-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">
                        Municipality
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {title.municipality}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></div>
                    <span className="font-semibold text-emerald-900">
                      Geographic Coordinates verified by Surveyor:
                    </span>
                    <span className="font-mono text-slate-700 bg-white border px-2 py-0.5 rounded font-bold">
                      Lat: {title.geoLat}, Lng: {title.geoLng}
                    </span>
                  </div>
                  <span className="text-slate-450 italic flex items-center space-x-1">
                    <Calendar size={12} />
                    <span>
                      Awarded on:{" "}
                      {new Date(title.encodedAt).toLocaleDateString()}
                    </span>
                  </span>
                </div>
              </div>
            ) : app?.status === "verified" ? (
              <div className="bg-amber-50 rounded-2xl border border-amber-250 p-6 text-left flex items-start space-x-3.5">
                <AlertCircle
                  size={22}
                  className="text-amber-700 shrink-0 mt-0.5 animate-bounce"
                />
                <div className="space-y-1">
                  <h3 className="font-bold text-amber-900 text-sm">
                    Waiting for Surveyor Encoding
                  </h3>
                  <p className="text-xs text-amber-750 leading-relaxed">
                    Great news! Your agrarian documents have been approved by
                    the Admin/Director. We are currently dispatching our
                    municipal surveyor to encode your precise geographic lot
                    limits and award your TCT title card in the digital system.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Document checklist summary */}
            {app && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Uploaded Application Documentation
                </h3>
                <p className="text-[10px] text-slate-400 mb-6">
                  These reference files were encoded during registration for
                  residency verification.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Cedula block */}
                  <div className="border border-slate-150 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                    <CreditCard size={20} className="text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        CTC (Cedula)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Identity / Tax reference
                      </span>
                    </div>
                    {app.documents.cedula ? (
                      <div className="h-20 w-32 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                        <img
                          src={app.documents.cedula}
                          alt="Cedula preview"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        Unattached
                      </span>
                    )}
                  </div>

                  {/* Birth cert block */}
                  <div className="border border-slate-150 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                    <FileText size={20} className="text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Birth Certificate
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Verified Kinship limits
                      </span>
                    </div>
                    {app.documents.birthCert ? (
                      <div className="h-20 w-32 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                        <img
                          src={app.documents.birthCert}
                          alt="Birth cert preview"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        Unattached
                      </span>
                    )}
                  </div>

                  {/* Barangay certificate */}
                  <div className="border border-slate-150 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                    <MapPin size={20} className="text-slate-500" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Barangay Residency Cert
                      </span>
                      <span className="text-[10px] text-slate-400">
                        10-Year municipal checks
                      </span>
                    </div>
                    {app.documents.brgyCert ? (
                      <div className="h-20 w-32 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
                        <img
                          src={app.documents.brgyCert}
                          alt="Brgy cert preview"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                        Unattached
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
};

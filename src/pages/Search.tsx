import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Search as SearchIcon,
  MapPin,
  Layers,
  Compass,
  User,
  ShieldAlert,
  Hash,
} from "lucide-react";

interface SearchResult {
  titleId: string;
  titleNumber: string;
  lotNumber: string;
  areaHectares: number;
  municipality: string;
  geoLat: string;
  geoLng: string;
  beneficiaryName: string;
  surveyorId: string;
  encodedAt: string;
}

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all titles from Firestore to do instant multi-field client-side query
  useEffect(() => {
    const fetchAllTitles = async () => {
      try {
        setLoading(true);
        const colRef = collection(db, "landTitles");
        const snap = await getDocs(colRef);

        const list: SearchResult[] = [];
        snap.forEach((d) => {
          list.push(d.data() as SearchResult);
        });

        setRecords(list);
      } catch (err) {
        console.error("Failed to load title search indices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllTitles();
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
              Beneficiary name, or Negros Occidental municipality.
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
                        className="hover:bg-slate-50/50 transition-colors"
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
                            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                              <User size={16} />
                            </span>
                            <span className="font-bold text-slate-800">
                              {item.beneficiaryName}
                            </span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col text-xs space-y-0.5">
                            <span className="inline-flex items-center space-x-1.5 font-bold text-slate-800">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{item.municipality}</span>
                            </span>
                            <span className="inline-flex items-center space-x-1 font-mono text-[9px] text-slate-405 bg-slate-50 px-1 py-0.5 border rounded w-fit">
                              <Compass size={10} className="text-slate-400" />
                              <span>
                                {item.geoLat}, {item.geoLng}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Hec */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-800 font-bold">
                          <span className="inline-flex items-center space-x-1.5">
                            <Layers size={14} className="text-slate-400" />
                            <span>{item.areaHectares} ha</span>
                          </span>
                        </td>

                        {/* Surveyor ID */}
                        <td className="px-6 py-4 whitespace-nowrap text-slate-450 italic text-xs">
                          {item.surveyorId}
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
                              name spelling. If new, confirm surveyors have
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
    </div>
  );
};

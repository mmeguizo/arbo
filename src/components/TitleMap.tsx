import React from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue (webpack/vite)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface TitleMapProps {
  geoLat: string | number;
  geoLng: string | number;
  height?: string | number;
  zoom?: number;
  interactive?: boolean;
}

export const TitleMap: React.FC<TitleMapProps> = ({
  geoLat,
  geoLng,
  height = 224,
  zoom = 15,
  interactive = true,
}) => {
  const lat = typeof geoLat === "string" ? parseFloat(geoLat) : geoLat;
  const lng = typeof geoLng === "string" ? parseFloat(geoLng) : geoLng;

  if (
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return (
      <div
        style={{ height }}
        className="bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400"
      >
        Invalid coordinates
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className="rounded-xl overflow-hidden border border-slate-200"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={defaultIcon} />
      </MapContainer>
    </div>
  );
};

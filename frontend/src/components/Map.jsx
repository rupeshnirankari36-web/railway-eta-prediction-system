import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map({ trains = [], selectedTrainId, selectedTrainEta, onSelectTrain }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered on Central India
      const map = L.map(mapContainerRef.current, {
        center: [22.5, 78.9],
        zoom: 5,
        minZoom: 4,
        maxZoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Free OpenStreetMap tiles (100% free, NO API key required)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size to ensure full rendering without grey areas
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    return () => {
      // Clean up map when component unmounts
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Train Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((marker) => map.removeLayer(marker));
    markersRef.current = {};

    trains.forEach((train) => {
      const lat = train.current_station?.latitude;
      const lon = train.current_station?.longitude;
      if (!lat || !lon) return;

      const delay = train.current_delay_minutes || 0;
      let delayClass = 'ontime';
      if (delay > 5) delayClass = 'minor';
      if (delay > 15) delayClass = 'major';

      const isSelected = selectedTrainId === train.train_id;

      const icon = L.divIcon({
        className: 'custom-train-marker-wrapper',
        html: `
          <div class="train-map-marker ${isSelected ? 'marker-selected' : ''}">
            <div class="marker-bubble ${delayClass}">
              <span>🚂</span>
              <span>${delay <= 0 ? 'OT' : `${delay}m`}</span>
            </div>
          </div>
        `,
        iconSize: [48, 30],
        iconAnchor: [24, 15],
      });

      const marker = L.marker([lat, lon], { icon }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; color: #111827; padding: 4px;">
          <div style="font-size: 13px; font-weight: 700; color: #1e3a8a;">#${train.train_id} ${train.train_name}</div>
          <div style="font-size: 11px; margin-top: 4px; color: #4b5563;">Class: <strong>${train.train_class}</strong> | Route: ${train.route}</div>
          <div style="font-size: 12px; margin-top: 6px;">
            Current Station: <strong>${train.current_station?.name || 'En route'}</strong>
          </div>
          <div style="font-size: 12px; margin-top: 4px;">
            Delay: <strong style="color: ${delay > 15 ? '#dc2626' : delay > 5 ? '#d97706' : '#16a34a'};">
              ${delay <= 0 ? 'On Time' : `${delay} mins late`}
            </strong>
          </div>
          <div style="font-size: 11px; margin-top: 4px; color: #6b7280;">Speed: ${train.current_speed_kmh || 0} km/h</div>
        </div>
      `);

      marker.on('click', () => {
        onSelectTrain(train.train_id);
      });

      markersRef.current[train.train_id] = marker;
    });
  }, [trains, selectedTrainId, onSelectTrain]);

  // Handle selected train pan & route line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (selectedTrainId && markersRef.current[selectedTrainId]) {
      const selectedMarker = markersRef.current[selectedTrainId];
      const targetLatLng = selectedMarker.getLatLng();
      map.panTo(targetLatLng, { animate: true, duration: 0.8 });

      // Draw polyline connecting upcoming stations if available
      if (selectedTrainEta && selectedTrainEta.predictions && selectedTrainEta.predictions.length > 0) {
        const routePoints = [
          [targetLatLng.lat, targetLatLng.lng],
          ...selectedTrainEta.predictions.map((p) => [p.latitude, p.longitude]),
        ];

        polylineRef.current = L.polyline(routePoints, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8',
        }).addTo(map);
      }
    }
  }, [selectedTrainId, selectedTrainEta]);

  return (
    <div className="map-section">
      <div id="map-container" ref={mapContainerRef} />
      <div className="map-controls-overlay">
        <button
          className="map-control-btn"
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([22.5, 78.9], 5, { animate: true });
            }
          }}
        >
          🇮🇳 Reset Fleet View
        </button>
      </div>
    </div>
  );
}

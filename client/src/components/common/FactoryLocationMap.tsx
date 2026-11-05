import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Factory, ChevronDown, ChevronUp } from 'lucide-react';
import { GeofenceConfig, GPSPosition } from '../../utils/geo.ts';

interface FactoryLocationMapProps {
  geofenceConfig?: GeofenceConfig | null;
  currentPosition?: GPSPosition | null;
  locationStatus: 'idle' | 'locating' | 'granted' | 'denied' | 'outside';
  distanceToUnit1?: number | null;
  distanceToUnit2?: number | null;
  detectedUnit?: string | null;
  isWithinPremises?: boolean;
  errorMessage?: string | null;
  onRefreshLocation: () => void;
  onRequestPermission: () => void;
}

export const FactoryLocationMap: React.FC<FactoryLocationMapProps> = ({
  geofenceConfig,
  currentPosition,
  locationStatus,
  distanceToUnit1,
  distanceToUnit2,
  detectedUnit,
  isWithinPremises,
  errorMessage,
  onRefreshLocation,
  onRequestPermission,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(true);

  const u1 = geofenceConfig?.unit1 || {
    name: 'Unit 1',
    latitude: 16.432500,
    longitude: 74.384222,
  };

  const u2 = geofenceConfig?.unit2 || {
    name: 'Unit 2',
    latitude: 16.344861,
    longitude: 74.441361,
  };

  const radiusMeters = geofenceConfig?.radiusMeters || 400;

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [u1.latitude, u1.longitude],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Unit 1 Marker & Geofence Circle
    const unit1Icon = L.divIcon({
      className: 'custom-unit-icon',
      html: `
        <div style="background: #4F46E5; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.4); border: 2px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const m1 = L.marker([u1.latitude, u1.longitude], { icon: unit1Icon })
      .bindPopup(`<b>🏭 ${u1.name}</b><br/>मर्यादा: ${radiusMeters}m आवारात`);
    group.addLayer(m1);

    const c1 = L.circle([u1.latitude, u1.longitude], {
      radius: radiusMeters,
      color: '#4F46E5',
      weight: 2,
      fillColor: '#4F46E5',
      fillOpacity: 0.12,
    });
    group.addLayer(c1);

    // 2. Unit 2 Marker & Geofence Circle
    const unit2Icon = L.divIcon({
      className: 'custom-unit-icon',
      html: `
        <div style="background: #0284C7; color: white; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4); border: 2px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const m2 = L.marker([u2.latitude, u2.longitude], { icon: unit2Icon })
      .bindPopup(`<b>🏭 ${u2.name}</b><br/>मर्यादा: ${radiusMeters}m आवारात`);
    group.addLayer(m2);

    const c2 = L.circle([u2.latitude, u2.longitude], {
      radius: radiusMeters,
      color: '#0284C7',
      weight: 2,
      fillColor: '#0284C7',
      fillOpacity: 0.12,
    });
    group.addLayer(c2);

    // 3. Worker Live Marker (if available)
    if (currentPosition) {
      const isInside = Boolean(isWithinPremises);
      const markerColor = isInside ? '#10B981' : '#EF4444';

      const workerIcon = L.divIcon({
        className: 'custom-worker-icon',
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${markerColor}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="background: ${markerColor}; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10;">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const workerMarker = L.marker([currentPosition.latitude, currentPosition.longitude], {
        icon: workerIcon,
      }).bindPopup(`<b>📍 तुमचे स्थान (You)</b><br/>${isInside ? '✅ फॅक्टरी आवारात' : '❌ आवाराबाहेर'}`);
      group.addLayer(workerMarker);

      // Connect line to nearest unit
      const targetUnitCoord = (distanceToUnit1 ?? 99999) <= (distanceToUnit2 ?? 99999)
        ? [u1.latitude, u1.longitude]
        : [u2.latitude, u2.longitude];

      const line = L.polyline(
        [
          [currentPosition.latitude, currentPosition.longitude],
          targetUnitCoord as [number, number],
        ],
        {
          color: markerColor,
          weight: 2,
          dashArray: '5, 8',
          opacity: 0.8,
        }
      );
      group.addLayer(line);

      // Fit map bounds to show worker and both units
      try {
        const bounds = group.getBounds();
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      } catch {}
    } else {
      // Focus between Unit 1 & Unit 2
      try {
        const bounds = L.latLngBounds([
          [u1.latitude, u1.longitude],
          [u2.latitude, u2.longitude],
        ]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } catch {}
    }

    // Invalidate size in case of tab/modal toggle
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [currentPosition, u1.latitude, u1.longitude, u2.latitude, u2.longitude, radiusMeters, isWithinPremises, distanceToUnit1, distanceToUnit2]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-6">
      {/* Top Banner / Live Radar Status */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md transition-all ${
                locationStatus === 'locating'
                  ? 'bg-amber-500 animate-spin'
                  : isWithinPremises
                  ? 'bg-emerald-600 shadow-emerald-500/20'
                  : currentPosition
                  ? 'bg-rose-600 shadow-rose-500/20'
                  : 'bg-amber-600 shadow-amber-500/20'
              }`}
            >
              {locationStatus === 'locating' ? (
                <RefreshCw className="w-5 h-5" />
              ) : isWithinPremises ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
                  GPS फॅक्टरी लोकेशन
                </span>
                {isWithinPremises ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    आवारात हजर ✅
                  </span>
                ) : currentPosition ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    आवाराबाहेर ❌
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    लोकेशन बंद 📍
                  </span>
                )}
              </div>

              <div className="text-sm font-semibold text-white mt-0.5">
                {locationStatus === 'locating' ? (
                  <span className="text-amber-300">लोकेशन शोधत आहे... (Locating GPS)</span>
                ) : isWithinPremises ? (
                  <span className="text-emerald-300 font-bold">
                    {detectedUnit || 'Factory Premises'} आवारात आहात
                  </span>
                ) : currentPosition ? (
                  <span className="text-rose-300 font-medium">
                    फॅक्टरी आवाराच्या बाहेर (हजेरीसाठी आवारात या)
                  </span>
                ) : (
                  <span className="text-amber-200">कृपया मोबाईलचे लोकेशन (GPS) चालू करा</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshLocation}
              disabled={locationStatus === 'locating'}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Location"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${locationStatus === 'locating' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">रिफ्रेश</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700"
              title={isMapExpanded ? 'Collapse Map' : 'Expand Map'}
            >
              {isMapExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Permission Request Prompt if Location is Off */}
        {!currentPosition && locationStatus !== 'locating' && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>हजेरी नोंदवण्यासाठी GPS ऑन करणे आवश्यक आहे.</span>
            </div>
            <button
              type="button"
              onClick={onRequestPermission}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all shrink-0 flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5" />
              लोकेशन ऑन करा
            </button>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mt-2 text-xs text-rose-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unit Distance Badges */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className={`p-2.5 rounded-xl border transition-all ${
            distanceToUnit1 !== null && distanceToUnit1 !== undefined && distanceToUnit1 <= radiusMeters
              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
              : 'bg-slate-800/50 border-slate-700/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Factory className="w-3.5 h-3.5 text-indigo-400" />
                <span>युनिट १ (Unit 1)</span>
              </div>
              {distanceToUnit1 !== null && distanceToUnit1 !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                  distanceToUnit1 <= radiusMeters ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {distanceToUnit1}m
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {u1.name} (कमाल {radiusMeters}m)
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${
            distanceToUnit2 !== null && distanceToUnit2 !== undefined && distanceToUnit2 <= radiusMeters
              ? 'bg-sky-950/40 border-sky-500/40 text-sky-200'
              : 'bg-slate-800/50 border-slate-700/60 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Factory className="w-3.5 h-3.5 text-sky-400" />
                <span>युनिट २ (Unit 2)</span>
              </div>
              {distanceToUnit2 !== null && distanceToUnit2 !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                  distanceToUnit2 <= radiusMeters ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {distanceToUnit2}m
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {u2.name} (कमाल {radiusMeters}m)
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map Canvas */}
      {isMapExpanded && (
        <div className="relative w-full h-56 sm:h-72 bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          
          {/* Map Overlay Badge */}
          <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/60 px-2.5 py-1 rounded-lg text-[10px] text-slate-300 flex items-center gap-1.5 shadow-md">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>लाइव्ह GPS जिओफेन्स पडताळणी</span>
          </div>
        </div>
      )}
    </div>
  );
};

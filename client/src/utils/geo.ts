/**
 * Geolocation Utility for Shree Swami Samarth Fabric Attendance System
 */

declare global {
  interface Window {
    AndroidBridge?: {
      isNativeApp?: () => boolean;
      hasLocationPermission?: () => boolean;
      requestLocationPermission?: () => void;
      isLocationServiceEnabled?: () => boolean;
      openLocationSettings?: () => void;
      getNativeGPSLocation?: () => string;
      showToast?: (msg: string) => void;
      triggerHaptic?: () => void;
      downloadBase64File?: (data: string, name: string, mime: string) => void;
    };
    onAndroidLocationPermissionGranted?: () => void;
  }
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeofenceConfig {
  enabled: boolean;
  radiusMeters: number;
  unit1: {
    name: string;
    latitude: number;
    longitude: number;
  };
  unit2: {
    name: string;
    latitude: number;
    longitude: number;
  };
}

/**
 * Check if running inside Android WebView with Native Bridge
 */
export function isAndroidNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AndroidBridge?.isNativeApp?.());
}

/**
 * Request OS runtime location permission
 */
export function requestDeviceLocationPermission(): void {
  if (typeof window !== 'undefined' && window.AndroidBridge?.requestLocationPermission) {
    window.AndroidBridge.requestLocationPermission();
  }
}

/**
 * Open Android system location settings
 */
export function openDeviceLocationSettings(): void {
  if (typeof window !== 'undefined' && window.AndroidBridge?.openLocationSettings) {
    window.AndroidBridge.openLocationSettings();
  }
}

/**
 * Great-circle distance using Haversine formula in meters
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Helper to parse native Android location JSON
 */
function tryGetNativeLocation(): GPSPosition | null {
  if (typeof window !== 'undefined' && window.AndroidBridge?.getNativeGPSLocation) {
    try {
      const raw = window.AndroidBridge.getNativeGPSLocation();
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.latitude === 'number' &&
          typeof parsed.longitude === 'number' &&
          !isNaN(parsed.latitude) &&
          !isNaN(parsed.longitude)
        ) {
          return {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy || 15,
            timestamp: parsed.timestamp || Date.now(),
          };
        }
      }
    } catch (e) {
      console.warn('Error reading native GPS location:', e);
    }
  }
  return null;
}

/**
 * Acquire worker's high-accuracy GPS position with native Android bridge fallback
 */
export async function getCurrentGPSPosition(timeoutMs: number = 10000): Promise<GPSPosition> {
  // 1. If running in Android App, check native bridge first
  if (typeof window !== 'undefined' && window.AndroidBridge) {
    const bridge = window.AndroidBridge;

    // Check if Android OS location permission is granted
    if (bridge.hasLocationPermission && !bridge.hasLocationPermission()) {
      bridge.requestLocationPermission?.();
    }

    // Check if device GPS toggle is turned on
    if (bridge.isLocationServiceEnabled && !bridge.isLocationServiceEnabled()) {
      bridge.openLocationSettings?.();
      throw new Error('कृपया मोबाईलचे GPS (Location) सेटिंग्जमध्ये चालू करा (Please enable GPS in phone settings).');
    }

    // Read native location if available
    const nativePos = tryGetNativeLocation();
    if (nativePos) {
      return nativePos;
    }
  }

  // 2. Standard Browser / WebView Geolocation
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('तुमच्या डिव्हाइसवर GPS लोकेशन सपोर्ट उपलब्ध नाही (Geolocation not supported).');
  }

  const queryBrowserLocation = (highAccuracy: boolean, timeout: number): Promise<GPSPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: highAccuracy,
          timeout,
          maximumAge: highAccuracy ? 0 : 30000,
        }
      );
    });
  };

  try {
    return await queryBrowserLocation(true, timeoutMs);
  } catch (err: any) {
    // If permission was denied in WebView, proactively trigger native permission prompt
    if (err.code === 1 && typeof window !== 'undefined' && window.AndroidBridge?.requestLocationPermission) {
      window.AndroidBridge.requestLocationPermission();
    }

    // Check if native location became available
    const fallbackNative = tryGetNativeLocation();
    if (fallbackNative) {
      return fallbackNative;
    }

    // Attempt second browser query with lower accuracy for cellular/wifi positioning
    if (err.code === 2 || err.code === 3) {
      try {
        return await queryBrowserLocation(false, 6000);
      } catch (_e) {
        // Fallback failed
      }
    }

    let msg = 'लोकेशन मिळवता आले नाही. कृपया फोनचे GPS चालू करा.';
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        msg = 'लोकेशन परवानगी आवश्यक आहे (Location Permission Required). कृपया ॲपला लोकेशन परवानगी द्या.';
        break;
      case 2: // POSITION_UNAVAILABLE
        msg = 'GPS सिग्नल उपलब्ध नाही (GPS signal unavailable). कृपया उघड्या जागेत जाऊन पुन्हा प्रयत्न करा.';
        break;
      case 3: // TIMEOUT
        msg = 'लोकेशन मिळण्यास उशीर झाला (Location timeout). कृपया पुन्हा प्रयत्न करा.';
        break;
    }
    throw new Error(msg);
  }
}

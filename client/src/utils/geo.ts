/**
 * Geolocation Utility for Shree Swami Samarth Fabric Attendance System
 */

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
 * Acquire worker's high-accuracy GPS position
 */
export function getCurrentGPSPosition(timeoutMs: number = 10000): Promise<GPSPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator || !navigator.geolocation) {
      return reject(
        new Error('तुमच्या डिव्हाइसवर GPS लोकेशन सपोर्ट उपलब्ध नाही (Geolocation not supported).')
      );
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        let msg = 'लोकेशन मिळवता आले नाही. कृपया फोनचे GPS चालू करा.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'लोकेशन परवानगी नाकारली (Location Permission Denied). कृपया ब्राउझर/ॲप सेटिंग्जमध्ये लोकेशन चालू करा.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'GPS सिग्नल उपलब्ध नाही (GPS signal unavailable). कृपया उघड्या जागेत जाऊन पुन्हा प्रयत्न करा.';
            break;
          case err.TIMEOUT:
            msg = 'लोकेशन मिळण्यास उशीर झाला (Location timeout). कृपया पुन्हा प्रयत्न करा.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

/**
 * A fix less precise than this cannot prove someone is in the room. Same limit
 * as the backend (common/geo.ts) for students checking in and for the lecturer
 * opening a session.
 */
export const MAX_ACCURACY_METERS = 100;

/** The browser's location, asking for GPS where the device has one. */
export function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
  });
}

/** Geolocation needs the API and a secure page (https, or localhost). */
export function canLocate(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext;
}

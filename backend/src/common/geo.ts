const EARTH_RADIUS_METERS = 6_371_000;

/**
 * A location fix less precise than this cannot prove someone is in the room -
 * neither the student checking in nor the lecturer setting a session's point.
 */
export const MAX_ACCURACY_METERS = 100;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two WGS 84 points (haversine formula). */
export function distanceInMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

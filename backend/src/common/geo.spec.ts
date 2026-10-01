import { distanceInMeters } from './geo';

describe('distanceInMeters (haversine)', () => {
  const room = { latitude: 18.8925, longitude: 99.0142 };

  it('is 0 for the same point', () => {
    expect(distanceInMeters(room, room)).toBe(0);
  });

  it('measures about 111 m for 0.001 degree of latitude', () => {
    const north = { latitude: room.latitude + 0.001, longitude: room.longitude };
    expect(distanceInMeters(room, north)).toBeCloseTo(111.2, 0);
  });

  it('shrinks a degree of longitude with latitude', () => {
    const east = { latitude: room.latitude, longitude: room.longitude + 0.001 };
    // cos(18.89°) ≈ 0.946
    expect(distanceInMeters(room, east)).toBeCloseTo(105.2, 0);
  });
});

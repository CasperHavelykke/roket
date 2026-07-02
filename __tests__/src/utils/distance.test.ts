import { formatDistance } from '../../../src/utils/distance';

// Minimal t-mock: samme nøgler som translations bruger til afstand
const t = {
  distanceMeters: (m: number) => `${m} m`,
  distanceKm: (km: string) => `${km} km`,
  distanceFeet: (ft: number) => `${ft} ft`,
  distanceMiles: (mi: string) => `${mi} mi`,
};

describe('formatDistance', () => {
  test('under 1 km vises i meter', () => {
    expect(formatDistance(0.2, t, 'km')).toBe('200 m');
  });

  test('1 km og over vises i km med komma-decimal', () => {
    expect(formatDistance(1.53, t, 'km')).toBe('1,5 km');
  });

  test('under 1 mil vises i fod', () => {
    // 0.5 km ≈ 0.31 mi ≈ 1640 ft
    expect(formatDistance(0.5, t, 'mi')).toBe('1640 ft');
  });

  test('1 mil og over vises i miles med punktum-decimal', () => {
    // 5 km ≈ 3.1 mi
    expect(formatDistance(5, t, 'mi')).toBe('3.1 mi');
  });
});

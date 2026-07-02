import { regionToQuery, MAX_QUERY_RADIUS_M } from '../../../../src/features/map/mapQuery';

const region = (latitude: number, longitude: number, latitudeDelta: number, longitudeDelta: number) => ({
  latitude,
  longitude,
  latitudeDelta,
  longitudeDelta,
});

describe('regionToQuery', () => {
  test('lille viewport giver aktiv query med radius snappet op til nærmeste trin', () => {
    // latDelta 0.05 ≈ 5,5 km høj viewport → rå radius ~2,8 km, × margin → trin 4000
    const q = regionToQuery(region(55.6761, 12.5683, 0.05, 0.05));
    expect(q.zoomedOut).toBe(false);
    expect(q.radiusM).toBe(4000);
  });

  test('lille pan ændrer ikke query-nøglen (grid-snapping)', () => {
    const a = regionToQuery(region(55.6761, 12.5683, 0.05, 0.05));
    const b = regionToQuery(region(55.6763, 12.5686, 0.05, 0.05)); // ~25 m pan
    expect(b.key).toBe(a.key);
  });

  test('stor pan ændrer nøglen', () => {
    const a = regionToQuery(region(55.6761, 12.5683, 0.05, 0.05));
    const b = regionToQuery(region(55.7761, 12.5683, 0.05, 0.05)); // ~11 km pan
    expect(b.key).not.toBe(a.key);
  });

  test('zoom-ændring inden for samme radius-trin genbruger nøglen', () => {
    const a = regionToQuery(region(55.6761, 12.5683, 0.05, 0.05));
    const b = regionToQuery(region(55.6761, 12.5683, 0.055, 0.055)); // stadig → trin 4000
    expect(b.key).toBe(a.key);
  });

  test('udzoomet forbi loftet melder zoomedOut uden query', () => {
    // latDelta 2 ≈ 222 km høj viewport → rå radius ~111 km > 50 km-loftet
    const q = regionToQuery(region(55, 12, 2, 2));
    expect(q.zoomedOut).toBe(true);
    expect(q.radiusM).toBe(0);
    expect(q.key).toBe('zoomed-out');
  });

  test('radius kan aldrig overstige loftet', () => {
    // Rå radius ~47 km (under loftet), men × margin ville give ~59 km → cappes
    const q = regionToQuery(region(55, 12, 0.85, 0.85));
    expect(q.zoomedOut).toBe(false);
    expect(q.radiusM).toBe(MAX_QUERY_RADIUS_M);
  });
});

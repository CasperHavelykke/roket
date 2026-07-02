import type { Region } from 'react-native-maps';

// Loft for query-radius. Zoomer brugeren længere ud end dette, spørger vi
// slet ikke Firestore (ubegrænset læsning af et helt land skalerer ikke) —
// UI viser i stedet "zoom ind"-tomtilstanden.
export const MAX_QUERY_RADIUS_M = 50_000;

// Diskrete radius-trin (meter). Snapping til faste trin gør at små
// zoom-ændringer genbruger præcis samme query (og dermed samme lyttere).
const RADIUS_STEPS = [500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, MAX_QUERY_RADIUS_M];

// Sikkerhedsmargin: centrum snappes til et grid (se nedenfor), så den
// faktiske viewport kan ligge lidt forskudt fra query-centrum. Marginen
// sikrer at den snappede radius stadig dækker hele viewporten.
const COVERAGE_MARGIN = 1.25;

const M_PER_DEG_LAT = 111_320;

export interface MapQuery {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  zoomedOut: boolean;
  // Stabil identitet for queryen. Effekter skal afhænge af denne — to
  // regioner der snapper til samme query giver samme key, og ingen re-query.
  key: string;
}

const ZOOMED_OUT: MapQuery = {
  centerLat: 0,
  centerLng: 0,
  radiusM: 0,
  zoomedOut: true,
  key: 'zoomed-out',
};

/**
 * Oversæt kortets viewport til en snappet, genbrugelig geo-query.
 *
 * To former for snapping (begge for at undgå query-churn ved småbevægelser):
 * - Radius snappes OP til nærmeste trin i RADIUS_STEPS (dækker altid viewporten).
 * - Centrum snappes til et grid på ¼ af radius — små pans lander i samme celle.
 */
export function regionToQuery(region: Region): MapQuery {
  const latM = region.latitudeDelta * M_PER_DEG_LAT;
  // Længdegrader bliver smallere mod polerne — korrigér med cos(lat)
  const lngM = region.longitudeDelta * M_PER_DEG_LAT * Math.cos((region.latitude * Math.PI) / 180);
  const rawRadiusM = Math.max(latM, lngM) / 2;

  if (rawRadiusM > MAX_QUERY_RADIUS_M) {
    return ZOOMED_OUT;
  }

  const radiusM =
    RADIUS_STEPS.find(step => step >= rawRadiusM * COVERAGE_MARGIN) ?? MAX_QUERY_RADIUS_M;

  const gridDeg = radiusM / 4 / M_PER_DEG_LAT;
  const centerLat = Math.round(region.latitude / gridDeg) * gridDeg;
  const centerLng = Math.round(region.longitude / gridDeg) * gridDeg;

  return {
    centerLat,
    centerLng,
    radiusM,
    zoomedOut: false,
    key: `${centerLat.toFixed(6)}_${centerLng.toFixed(6)}_${radiusM}`,
  };
}

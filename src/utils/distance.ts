// Ren afstandsformattering — samme konventioner som profilernes visning
// (ProfilePreviewModal), men uden fuzzy/hidden-modes: aktiviteters placering
// er offentlig per design, så events viser altid præcis afstand.

export type DistanceUnit = 'km' | 'mi';

export function formatDistance(km: number, t: any, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const miles = km * 0.621371;
    if (miles < 1) return t.distanceFeet(Math.round(miles * 5280));
    return t.distanceMiles(miles.toFixed(1));
  }
  if (km < 1) return t.distanceMeters(Math.round(km * 1000));
  return t.distanceKm(km.toFixed(1).replace('.', ','));
}

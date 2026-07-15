import { useEffect, useState } from 'react';

/**
 * Tikkende "nu" til skærme, der lever længe (kortet unmountes aldrig):
 * uden et clock-tick fryser alle new Date()-baserede beregninger på
 * render-tidspunktet — udløbne aktiviteter bliver stående på kortet,
 * scrubberens NU-markør sakker bagud, og "Starter om X min" lyver.
 *
 * 30 sekunder er rigeligt: den fineste tidsopløsning i UI'et er
 * minutter/kvarterer.
 */
export default function useNow(intervalMs: number = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

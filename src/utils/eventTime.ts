// Ren tids-formattering til events, isoleret fra UI så funktionen kan
// importeres af en test uden at trække komponent-/native-imports med.

export const LOCALE_MAP: Record<string, string> = {
  da: 'da-DK', en: 'en-GB', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT',
};

export function formatTime(time: Date, t: any, locale: string, hour12: boolean): string {
  const now = Date.now();
  const diffMs = time.getTime() - now;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 0) return t.eventsTimeAgo;
  if (diffMins < 60) return t.eventsTimeIn(diffMins);

  const today = new Date();
  const eventDay = new Date(time);
  const isToday = today.toDateString() === eventDay.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.toDateString() === eventDay.toDateString();

  const timeStr = eventDay.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });

  if (isToday) return `${t.eventsTimeToday} ${timeStr}`;
  if (isTomorrow) return `${t.eventsTimeTomorrow} ${timeStr}`;
  const dateStr = eventDay.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

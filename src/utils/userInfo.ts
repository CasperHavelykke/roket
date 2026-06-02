// Rene beregninger over user-data — isoleret så de kan importeres
// uden at trække HomeScreen's komponent-/native-imports med.

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutter

export function isOnline(lastSeen?: Date): boolean {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < ONLINE_WINDOW_MS;
}

export function getAge(birthday: { day: number; month: number; year: number }): number {
  const today = new Date();
  const birth = new Date(birthday.year, birthday.month - 1, birthday.day);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

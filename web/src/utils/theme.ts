export function isDarkMode(): boolean {
  const saved = localStorage.getItem('roket-theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function placeholderPic(): string {
  return isDarkMode() ? '/missing-profile-pic.png' : '/missing-profile-pic-light.png';
}

export const PALETTES = [
  { bg: '#E8F5F3', text: '#1A7A6E' },
  { bg: '#EEF0FB', text: '#3D5BD9' },
  { bg: '#FDF3E7', text: '#B85C0A' },
  { bg: '#FAEAEA', text: '#C94040' },
  { bg: '#EEECEA', text: '#6B6560' },
];

export function getAvatarPalette(id: string): { bg: string; text: string } {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[hash % PALETTES.length];
}

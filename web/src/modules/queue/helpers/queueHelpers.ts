// Enlaces que se abren en cada equipo (kiosco, pantalla, celular) y el anuncio por voz del llamado

export type PaperWidth = '58' | '80' | '0';

const appBase = () => `${window.location.origin}${window.location.pathname}`;

const withQuery = (path: string, query: Record<string, string | number | null | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  });
  const search = params.toString();
  return `${appBase()}#${path}${search ? `?${search}` : ''}`;
};

export const buildKioskUrl = (siteId: number | null, paper: PaperWidth) =>
  withQuery('/kiosco', { sede: siteId, papel: paper });

export const buildDisplayUrl = (siteId: number | null) => withQuery('/pantalla', { sede: siteId });

export const buildTrackUrl = (token: string) => `${appBase()}#/t/${token}`;

export const parseSiteParam = (value: unknown) => {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// "C-015" se lee "C 15"; "CH-007" se lee "C H 7"
export const spokenCode = (code: string) => {
  const [prefix, number] = code.split('-');
  return `${(prefix ?? '').split('').join(' ')} ${Number(number ?? 0)}`;
};

const SPEECH_LANG: Record<string, string> = { es: 'es-ES', 'en-US': 'en-US', 'pt-BR': 'pt-BR' };

export const announce = (text: string, locale: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG[locale] ?? locale;
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export const minutesSince = (iso: string | null, now = Date.now()) =>
  iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)) : 0;

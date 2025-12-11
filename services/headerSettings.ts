import { getApiBaseUrl } from './config';

export type HeaderButtonKey = 'explorer' | 'events' | 'excursions' | 'contact' | 'trips';

export interface HeaderButtonStyle {
  key: HeaderButtonKey;
  label: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing?: number;
  uppercase?: boolean;
  color: string;
  bg: string;
  shadow?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  selectedBg?: string;
  selectedBorderColor?: string;
  selectedShadow?: string;
  selectedBlur?: number;
  selectedShadowColor?: string;
  selectedShadowIntensity?: number;
}

export interface HeaderContextSettings {
  header: { bg?: string; gradient?: string | null; blur?: number; shadow?: string; borderColor?: string };
  logo: { url?: string; width?: number; height?: number; alt?: string };
  buttons: HeaderButtonStyle[];
  overrides?: Record<string, Partial<HeaderButtonStyle>>;
  sidebar?: { cardBg?: string; sidebarBg?: string };
  burgerMenu?: { color?: string; size?: number; strokeWidth?: number; bg?: string; padding?: number; borderRadius?: number };
}

export interface HeaderSettings {
  updatedAt?: string;
  light: { mobile: HeaderContextSettings; desktop: HeaderContextSettings };
  dark: { mobile: HeaderContextSettings; desktop: HeaderContextSettings };
}

const CACHE_KEY = 'dg_header_settings_cache_v1';

export async function fetchHeaderSettings(): Promise<HeaderSettings> {
  try {
    // Always bypass caches to pick up latest admin changes immediately
    const base = getApiBaseUrl();
    const url = `${base.replace(/\/$/, '')}/api/settings/header?v=${Date.now()}`;
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load header settings');
    const json = await res.json();
    // Keep a local fallback, but we never trust it over network
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(json)); } catch {}
    return json;
  } catch (e) {
    // Fallback to last known good settings if network fails
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    throw e;
  }
}

export function resolveHeaderContext(settings: HeaderSettings, theme: 'light' | 'dark', isDesktop: boolean): HeaderContextSettings {
  const ctx = settings[theme][isDesktop ? 'desktop' : 'mobile'];
  return ctx;
}

export function resolveButtonStyle(ctx: HeaderContextSettings, key: HeaderButtonKey): HeaderButtonStyle | undefined {
  const base = ctx.buttons.find(b => b.key === key);
  if (!base) return undefined;
  const ov = (ctx.overrides && ctx.overrides[key]) || {};
  return { ...base, ...ov };
}



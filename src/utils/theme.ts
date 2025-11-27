export type ThemeName = 'red' | 'pink' | 'blue';

interface ThemeTokens {
  MagnoGrabr: string;
  ButtonActive: string;
  ButtonActiveHover: string;
  ButtonNotActive: string;
  ButtonNotActiveHover: string;
  RootBG: string;
  LinkBG: string;
  FilterTagBG: string;
  Lable: string;
  ScroolbarTrack: string;
  ScroolbarBG: string;
  TextIn: string;
  TextMd: string;
  TextOut: string;
  SwitcherBG: string;
  SwitcherBGHover: string;
  Source: string;
  SourceHover: string;
}

const THEMES: Record<ThemeName, ThemeTokens> = {
  'red': {
    MagnoGrabr: '#D60003',
    RootBG: '#272727',
    LinkBG: '#404040',
    ButtonActive: '#F72E2C',
    ButtonActiveHover: '#C6211F',
    ButtonNotActive: '#1F1F1F',
    ButtonNotActiveHover: '#2B2B2B',
    FilterTagBG: '#181818',
    Lable: '#999999',
    ScroolbarTrack: '#F72E2C',
    ScroolbarBG: '#272727',
    TextIn: '#E6E6E6',
    TextMd: '#E6E6E6',
    TextOut: '#E6E6E6',
    SwitcherBG: '#1F1F1F',
    SwitcherBGHover: '#2B2B2B',
    Source: '#E6E6E6',
    SourceHover: '#D60003',
    

  },
  'pink': {
    MagnoGrabr: '#FF00BF',
    RootBG: '#ffb7c2',
    LinkBG: '#fcc2cb',
    ButtonActive: '#FF00FF',
    ButtonActiveHover: '#C500C5',
    ButtonNotActive: '#F8C8DC',
    ButtonNotActiveHover: '#E3A9BF',
    FilterTagBG: '#F8C8DC',
    Lable: '#fe7f71',
    ScroolbarTrack: '#FF00FF',
    ScroolbarBG: '#ffb7c2',
    TextIn: '#FFFFFF',
    TextMd: '#FF69B4',
    TextOut: '#FF69B4',
    SwitcherBG: '#EEC0C8',
    SwitcherBGHover: '#EEC0C8',
    Source: '#FA8072',
    SourceHover: '#FF00BF'
  },
  'blue': {
    MagnoGrabr: '#00008B',
    RootBG: '#1e7ec6',
    LinkBG: '#378bc9',
    ButtonActive: '#0000CD',
    ButtonActiveHover: '#3b63e6',
    ButtonNotActive: '#0076CE',
    ButtonNotActiveHover: '#8da7ff',
    FilterTagBG: '#0076CE',
    Lable: '#072b9c',
    ScroolbarTrack: '#0000CD',
    ScroolbarBG: '#1e7ec6',
    TextIn: '#E0FFFF',
    TextMd: '#E0FFFF',
    TextOut: '#E0FFFF',
    SwitcherBG: '#3E8EDE',
    SwitcherBGHover: '#3E8EDE',
    Source: '#69E5FF',
    SourceHover: '#00008B'
  }
};

function isThemeName(value: string): value is ThemeName {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}

function applyThemeVariables(themeName: ThemeName) {
  const root = document.documentElement;
  const theme = THEMES[themeName];

  // core tokens (keeps old token names for compatibility)
  root.style.setProperty('--MagnoGrabr', theme.MagnoGrabr);
  root.style.setProperty('--ButtonActive', theme.ButtonActive);
  root.style.setProperty('--ButtonActiveHover', theme.ButtonActiveHover);
  root.style.setProperty('--ButtonNotActive', theme.ButtonNotActive);
  root.style.setProperty('--ButtonNotActiveHover', theme.ButtonNotActiveHover);

  // application-facing variables (what utilities expect)
  root.style.setProperty('--primary', theme.MagnoGrabr);
  root.style.setProperty('--primary-600', theme.ButtonActive);
  root.style.setProperty('--primary-700', theme.ButtonActiveHover);
  root.style.setProperty('--scroll-thumb', theme.MagnoGrabr);

  // expose remaining theme tokens as CSS variables for fine-grained mapping
  root.style.setProperty('--RootBG', theme.RootBG);
  root.style.setProperty('--LinkBG', theme.LinkBG);
  root.style.setProperty('--FilterTagBG', theme.FilterTagBG);
  root.style.setProperty('--Lable', theme.Lable);
  root.style.setProperty('--ScroolbarTrack', theme.ScroolbarTrack);
  root.style.setProperty('--ScroolbarBG', theme.ScroolbarBG);
  root.style.setProperty('--TextIn', theme.TextIn);
  root.style.setProperty('--TextMd', theme.TextMd);
  root.style.setProperty('--TextOut', theme.TextOut);
  root.style.setProperty('--SwitcherBG', theme.SwitcherBG);
  root.style.setProperty('--SwitcherBGHover', theme.SwitcherBGHover);
  root.style.setProperty('--Source', theme.Source);
  root.style.setProperty('--SourceHover', theme.SourceHover);

  // also set a data attribute for easier selector-based fallbacks
  root.setAttribute('data-theme', themeName);
}

export function setTheme(themeName: string | ThemeName) {
  if (!themeName) return;
  const name = typeof themeName === 'string' ? themeName : (themeName as string);
  if (!isThemeName(name)) return;
  applyThemeVariables(name);
}

export function initThemeFromSettings(settings?: { theme?: string }) {
  const themeName = settings?.theme ?? 'red';
  setTheme(themeName);
}

export function availableThemes(): ThemeName[] {
  return Object.keys(THEMES) as ThemeName[];
}

const ThemeManager = { setTheme, initThemeFromSettings, availableThemes };
export default ThemeManager;

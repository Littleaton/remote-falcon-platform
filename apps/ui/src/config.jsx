export const JWT_API = {
  secret: 'secret',
  timeout: '30 days'
};

export const BASE_PATH = '';

export const CLEAN_CONTROL_PANEL_PATHS = import.meta.env.VITE_SWAP_CP === 'true';

// In a single-show self-hosted deployment the control-panel hostname already
// identifies the app, so repeating `/control-panel` in every URL is redundant.
// Keep the hosted/SaaS routes unchanged while exposing short paths on the
// dedicated control-panel hostname.
export const normalizeControlPanelPath = (path, cleanPaths = CLEAN_CONTROL_PANEL_PATHS) => {
  if (!cleanPaths || typeof path !== 'string') return path;

  const normalized = path.replace(/^\/control-panel(?=\/|$)/, '');
  return normalized || '/dashboard';
};

export const CONTROL_PANEL_PATH = CLEAN_CONTROL_PANEL_PATHS ? '/dashboard' : '/control-panel';

export const VERSION = import.meta.env.VITE_VERSION;

const config = {
  fontFamily: `'Roboto', sans-serif`,
  borderRadius: 8,
  outlinedFilled: false,
  navType: 'dark',
  presetColor: 'theme3',
  locale: 'en',
  rtlLayout: false,
  container: true,
  // v2 dashboard sidebar — collapsed = 72px icon rail, expanded = 248px.
  // Persisted via the ConfigContext localStorage key (`rf-config`).
  sidebarCollapsed: false
};

export default config;

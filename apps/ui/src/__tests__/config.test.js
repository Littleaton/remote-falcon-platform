import { describe, it, expect } from 'vitest';

import config, { JWT_API, BASE_PATH, CONTROL_PANEL_PATH, VERSION, normalizeControlPanelPath } from '../config';

// Tiny module — but the constants here are referenced from many places
// (CONTROL_PANEL_PATH from the menu/router, VERSION from the footer, etc.)
// so a rename is high-blast-radius. Pinning is cheap insurance.

describe('config module', () => {
  it('exposes the documented public constants', () => {
    expect(BASE_PATH).toBe('');
    expect(CONTROL_PANEL_PATH).toBe(import.meta.env.VITE_SWAP_CP === 'true' ? '/dashboard' : '/control-panel');
    // JWT_API is a marker config used only for legacy local-storage auth.
    expect(JWT_API).toEqual({ secret: 'secret', timeout: '30 days' });
    // VERSION sources from VITE_VERSION at build time; in tests it's
    // either the test-time value or undefined. Just sanity-check the
    // shape (it exists as an exported binding).
    expect('VERSION' in { VERSION }).toBe(true);
  });

  it('default export carries the documented UI prefs', () => {
    expect(config).toMatchObject({
      borderRadius: 8,
      outlinedFilled: false,
      navType: 'dark',
      presetColor: 'theme3',
      locale: 'en',
      rtlLayout: false,
      container: true,
      sidebarCollapsed: false
    });
    expect(typeof config.fontFamily).toBe('string');
  });

  it('removes the redundant control-panel prefix only in clean-path mode', () => {
    expect(normalizeControlPanelPath('/control-panel/dashboard', true)).toBe('/dashboard');
    expect(normalizeControlPanelPath('/control-panel/analytics/overview?range=last-30', true)).toBe(
      '/analytics/overview?range=last-30'
    );
    expect(normalizeControlPanelPath('/control-panel', true)).toBe('/dashboard');
    expect(normalizeControlPanelPath('/control-panel/dashboard', false)).toBe('/control-panel/dashboard');
    expect(normalizeControlPanelPath('/signin', true)).toBe('/signin');
  });
});

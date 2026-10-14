import { describe, expect, it } from 'vitest';

import { buildQrUrl } from '../qrUrl';

describe('buildQrUrl', () => {
  it('uses the automatic public show URL by default', () => {
    expect(buildQrUrl({ publicUrl: 'https://lights.example.com', customUrlEnabled: false, customUrl: '', utmTagged: false }))
      .toEqual({ encodedUrl: 'https://lights.example.com', error: '' });
  });

  it('uses and trims an enabled custom URL', () => {
    expect(buildQrUrl({ publicUrl: 'https://show.example.com', customUrlEnabled: true, customUrl: '  https://event.example.com/vote  ', utmTagged: false }))
      .toEqual({ encodedUrl: 'https://event.example.com/vote', error: '' });
  });

  it('appends the print campaign to a custom URL that already has a query string', () => {
    expect(buildQrUrl({ publicUrl: '', customUrlEnabled: true, customUrl: 'https://event.example.com/?night=friday', utmTagged: true }))
      .toEqual({ encodedUrl: 'https://event.example.com/?night=friday&utm_source=qr&utm_medium=print', error: '' });
  });

  it('requires a custom URL when the option is enabled', () => {
    expect(buildQrUrl({ publicUrl: 'https://show.example.com', customUrlEnabled: true, customUrl: ' ', utmTagged: false }))
      .toEqual({ encodedUrl: '', error: 'Enter a custom URL.' });
  });

  it('rejects invalid or non-web custom destinations', () => {
    expect(buildQrUrl({ publicUrl: '', customUrlEnabled: true, customUrl: 'not a url', utmTagged: false }).error)
      .toBe('Enter a valid URL.');
    expect(buildQrUrl({ publicUrl: '', customUrlEnabled: true, customUrl: 'javascript:alert(1)', utmTagged: false }).error)
      .toBe('Enter a URL that starts with http:// or https://.');
  });
});

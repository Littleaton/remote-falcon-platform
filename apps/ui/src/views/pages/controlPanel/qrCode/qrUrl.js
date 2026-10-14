const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export const buildQrUrl = ({ publicUrl, customUrlEnabled, customUrl, utmTagged }) => {
  let baseUrl = publicUrl?.trim() || '';

  if (customUrlEnabled) {
    baseUrl = customUrl?.trim() || '';
    if (!baseUrl) return { encodedUrl: '', error: 'Enter a custom URL.' };

    try {
      const parsed = new URL(baseUrl);
      if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
        return { encodedUrl: '', error: 'Enter a URL that starts with http:// or https://.' };
      }
    } catch {
      return { encodedUrl: '', error: 'Enter a valid URL.' };
    }
  }

  if (!baseUrl) return { encodedUrl: '', error: '' };
  if (!utmTagged) return { encodedUrl: baseUrl, error: '' };

  return {
    encodedUrl: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}utm_source=qr&utm_medium=print`,
    error: ''
  };
};

export default buildQrUrl;

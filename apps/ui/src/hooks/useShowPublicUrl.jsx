import { useMemo } from 'react';

import { useSelector } from '../store';
import { getShowPublicUrl } from '../utils/showPublicUrl';

// Resolves the public viewer-page URL for the current show. A configured
// self-hosted redirect is the visitor-facing destination, so owner actions
// such as the dashboard link and QR generator should use it directly.
// Environment handling for the Remote Falcon fallback lives in
// getShowPublicUrl so unauthenticated pages can reuse it for any subdomain.
const useShowPublicUrl = () => {
  const { show } = useSelector((state) => state.show);

  return useMemo(
    () => show?.preferences?.selfHostedRedirectUrl?.trim() || getShowPublicUrl(show?.showSubdomain),
    [show?.preferences?.selfHostedRedirectUrl, show?.showSubdomain]
  );
};

export default useShowPublicUrl;

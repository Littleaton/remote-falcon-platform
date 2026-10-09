import { Navigate, useLocation, useRoutes } from 'react-router-dom';

import { CLEAN_CONTROL_PANEL_PATHS, normalizeControlPanelPath } from '../config';
import LoginRoutes from './LoginRoutes';
import MainRoutes from './MainRoutes';
import MapRoutes from './MapRoutes';
import ViewerRoutes from './ViewerRoutes';
import WrappedRoutes from './WrappedRoutes';
import { getViewerPath, isExternalViewer } from '../utils/route-guard/helpers/helpers';

// Catch-all for unknown URLs. Sends the user to /404, which is a real
// route inside LoginRoutes that renders the v2 NotFound page.
const NotFoundRedirect = {
  path: '*',
  element: <Navigate to="/404" replace />
};

// Keep old bookmarks usable after enabling clean self-hosted URLs. Query
// strings and hashes are retained so analytics filters and deep links survive.
const LegacyControlPanelRedirect = () => {
  const location = useLocation();
  const destination = normalizeControlPanelPath(location.pathname);

  return <Navigate to={`${destination}${location.search}${location.hash}`} replace />;
};

const LegacyControlPanelRoute = {
  path: '/control-panel/*',
  element: <LegacyControlPanelRedirect />
};

export default function ThemeRoutes() {
  // In single-show mode both the marketing/login shell and the viewer use `/`.
  // Select the route family by hostname so the landing route cannot win the
  // tie on the dedicated viewer host. Unknown viewer-host paths canonicalize
  // back to the viewer root instead of exposing control-panel/login screens.
  const viewerOnly = CLEAN_CONTROL_PANEL_PATHS && isExternalViewer();
  const routes = viewerOnly
    ? [
        ViewerRoutes,
        {
          path: '*',
          element: <Navigate to={getViewerPath()} replace />
        }
      ]
    : [
        WrappedRoutes,
        MapRoutes,
        LoginRoutes,
        MainRoutes,
        ViewerRoutes,
        ...(CLEAN_CONTROL_PANEL_PATHS ? [LegacyControlPanelRoute] : []),
        NotFoundRedirect
      ];

  return useRoutes(routes);
}

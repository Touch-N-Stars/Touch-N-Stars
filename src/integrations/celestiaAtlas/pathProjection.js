import { projectEquatorial } from '@acocalypso/celestia-atlas';

// Older pinned Atlas versions expose an east-right equatorial getView(). Newer
// versions expose their actual projection basis so overlays follow either mode.
export function projectAtlasPathPoint(viewer, point, width, height) {
  const view = viewer.getProjectionView?.() ?? viewer.getView();
  return projectEquatorial(
    { raDeg: point.raHours * 15, decDeg: point.decDeg, frame: view.center.frame },
    view,
    width,
    height
  );
}

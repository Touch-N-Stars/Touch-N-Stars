// Screw layouts, mirroring TilterService.GetScrewPositions on the backend. Angles are in SVG
// screen space (y grows downward, so screen_y = -math_y), seen from the back of the camera.
// 3 screws: equilateral plate (P1 upper left, P2 bottom, P3 upper right) - the Wanderer ETA.
// 4 screws: one screw on each diagonal, under a sensor corner.
export const SCREW_LAYOUTS = {
  3: [
    { label: 'P1', angle: 210, color: '#60a5fa' },
    { label: 'P2', angle: 90, color: '#4ade80' },
    { label: 'P3', angle: 330, color: '#fb923c' },
  ],
  // nameKey: the corner's full name (plugins.hocusfocus.tilter.*) where there is room for it
  4: [
    { label: 'TL', nameKey: 'cornerTopLeft', angle: 315, color: '#60a5fa' },
    { label: 'TR', nameKey: 'cornerTopRight', angle: 225, color: '#4ade80' },
    { label: 'BL', nameKey: 'cornerBottomLeft', angle: 45, color: '#fb923c' },
    { label: 'BR', nameKey: 'cornerBottomRight', angle: 135, color: '#c084fc' },
  ],
};

// Travel of each Wanderer ETA actuator, in mm (TilterService.EtaTravel)
export const ETA_TRAVEL = 1.2;

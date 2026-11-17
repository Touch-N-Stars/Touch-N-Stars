import test from 'node:test';
import assert from 'node:assert/strict';
import { projectAtlasPathPoint } from '../pathProjection.js';

const view = { center: { raDeg: 120, decDeg: 30, frame: 'J2000' }, fovDeg: 60 };
const point = { raHours: 121 / 15, decDeg: 30 };

test('Perihelion paths follow the projection basis of old and corrected Atlas versions', () => {
  const oldViewer = { getView: () => view };
  const newViewer = { ...oldViewer, getProjectionView: () => ({ ...view, mirrorX: true }) };
  const oldPoint = projectAtlasPathPoint(oldViewer, point, 1000, 600);
  const newPoint = projectAtlasPathPoint(newViewer, point, 1000, 600);
  assert.ok(oldPoint.x > 500);
  assert.ok(newPoint.x < 500);
  assert.ok(Math.abs(oldPoint.x + newPoint.x - 1000) < 1e-9);
  assert.equal(oldPoint.y, newPoint.y);
});

test('Perihelion projection uses the gnomonic focal length and clips the back hemisphere', () => {
  const viewer = { getView: () => ({ ...view, center: { ...view.center, decDeg: 0 } }) };
  const point = projectAtlasPathPoint(viewer, { raHours: 9, decDeg: 0 }, 1000, 600);
  const expected = 500 + (500 / Math.tan(Math.PI / 6)) * Math.tan(Math.PI / 12);
  assert.ok(Math.abs(point.x - expected) < 1e-9);
  assert.equal(projectAtlasPathPoint(viewer, { raHours: 20, decDeg: 0 }, 1000, 600), null);
});

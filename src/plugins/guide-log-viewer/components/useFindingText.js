// Titles and one-line explanations of the findings ("Worth a look"), shared by the list, the
// guide graph and the night overview so a marker reads the same everywhere.
import { useI18n } from 'vue-i18n';
import { formatDuration } from '../utils/logView';

/**
 * `display` (optional) returns { unit: 'arcsec' | 'px', pixelScale } so distances read in the
 * viewer's unit.
 */
export function useFindingText(display = () => ({})) {
  const { t, te } = useI18n();
  const BASE = 'plugins.guideLogViewer.findings';
  const fixed = (v, digits = 1) => v.toFixed(digits);
  /** A distance given in arcsec, in the viewer's unit. */
  const as = (v) => {
    if (!Number.isFinite(v)) return '–';
    const { unit, pixelScale } = display() ?? {};
    if (unit !== 'px') return t(`${BASE}.arcsec`, { value: fixed(v) });
    return pixelScale > 0 ? t(`${BASE}.px`, { value: fixed(v / pixelScale) }) : '–';
  };
  const pier = (side) => {
    const key = `plugins.guideLogViewer.sessions.pier.${side}`;
    return side && te(key) ? t(key) : side;
  };

  function title(f) {
    if (f.kind === 'alert') {
      const key = `components.guider.native.alerts.${f.params.name}.title`;
      return te(key) ? t(key) : f.params.message || f.params.name;
    }
    if (f.kind === 'incident') {
      const key = `components.guider.native.incidents.kinds.${f.params.incidentKind}`;
      return t(`${BASE}.kinds.incident`) + ': ' + (te(key) ? t(key) : f.params.incidentKind);
    }
    return t(`${BASE}.kinds.${f.kind}`);
  }

  function detail(f) {
    const p = f.params ?? {};
    const duration = formatDuration(f.t1 - f.t0);
    switch (f.kind) {
      case 'starLost':
        return t(`${BASE}.detail.starLost`, { frames: p.frames, duration }, p.frames);
      case 'badStretch':
        return t(`${BASE}.detail.badStretch`, {
          rms: as(p.rms),
          ratio: fixed(p.ratio),
          typical: as(p.typical),
          duration,
        });
      case 'jump':
        return t(`${BASE}.detail.jump`, {
          axis: p.axis,
          value: as(p.arcsec),
          typical: as(p.typical),
        });
      case 'clouds':
        return t(`${BASE}.detail.clouds`, {
          snr: Math.round(p.snr),
          typical: Math.round(p.typical),
          duration,
        });
      case 'settle':
        return p.failed
          ? t(`${BASE}.detail.settleFailed`, { duration })
          : t(`${BASE}.detail.settleSlow`, { duration, typical: formatDuration(p.typical) });
      case 'pulseLimit':
        return t(`${BASE}.detail.pulseLimit`, { frames: p.frames }, p.frames);
      case 'alert':
        return p.message && p.message !== title(f) ? p.message : '';
      case 'flip':
        return t(`${BASE}.detail.flip`, { from: pier(p.from), to: pier(p.to) });
      case 'gap':
        return t(`${BASE}.detail.gap`, { duration: formatDuration(p.minutes * 60) });
      case 'param':
        return p.change;
      case 'calibration':
        return p.failed
          ? t(`${BASE}.detail.calibrationFailed`)
          : t(`${BASE}.detail.calibration`, { steps: p.steps }, p.steps);
      case 'incident': {
        const key = `components.guider.native.incidents.causes.${p.cause}.title`;
        return p.cause && te(key) ? t(`${BASE}.detail.incident`, { cause: t(key) }) : '';
      }
      default:
        return '';
    }
  }

  return { title, detail };
}

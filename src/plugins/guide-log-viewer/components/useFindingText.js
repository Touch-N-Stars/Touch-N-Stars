// Titles and one-line explanations of the findings ("Worth a look"), shared by the list, the
// guide graph and the night overview so a marker reads the same everywhere.
import { useI18n } from 'vue-i18n';
import { formatDuration } from '../utils/logView';

export function useFindingText() {
  const { t, te } = useI18n();
  const BASE = 'plugins.guideLogViewer.findings';
  const as = (v) => (Number.isFinite(v) ? `${v.toFixed(1)}″` : '–');

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
        return t(`${BASE}.detail.starLost`, { frames: p.frames, duration });
      case 'badStretch':
        return t(`${BASE}.detail.badStretch`, {
          rms: as(p.rms),
          ratio: p.ratio.toFixed(1),
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
        return t(`${BASE}.detail.pulseLimit`, { frames: p.frames });
      case 'alert':
        return p.message && p.message !== title(f) ? p.message : '';
      case 'flip':
        return t(`${BASE}.detail.flip`, { from: p.from, to: p.to });
      case 'gap':
        return t(`${BASE}.detail.gap`, { duration: formatDuration(p.minutes * 60) });
      case 'param':
        return p.change;
      case 'calibration':
        return p.failed
          ? t(`${BASE}.detail.calibrationFailed`)
          : t(`${BASE}.detail.calibration`, { steps: p.steps });
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

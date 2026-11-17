import { useI18n } from 'vue-i18n';
import {
  INCIDENTS_TEXT_BASE,
  causeText,
  endReasonText,
  evidenceText,
  kindText,
  markerTypeText,
} from '@/utils/nativeGuiderIncidents';

/** Localized texts of the flight recorder (kinds, causes, evidence, end reasons, times). */
export function useIncidentText() {
  const { t, te } = useI18n();

  /** t() relative to components.guider.native.incidents. */
  const k = (key, params) => t(`${INCIDENTS_TEXT_BASE}.${key}`, params ?? {});

  const kind = (value) => kindText({ t, te }, value);

  /** All trigger kinds of a summary in words, in order, without repeats. */
  function kinds(summary) {
    const list = Array.isArray(summary?.kinds) && summary.kinds.length ? summary.kinds : [];
    const all = list.length ? list : summary?.kind ? [summary.kind] : [];
    return [...new Set(all)].map(kind).join(' · ');
  }

  /** "Likely: clouds" of a summary or diagnosis cause; empty without a cause. */
  function likely(cause, message) {
    if (!cause) return '';
    return k('likely', { cause: causeText({ t, te }, cause, message).title });
  }

  /** Date and time of a start ("Sep 26, 02:13"). */
  function dateTime(timestamp) {
    const ms = Date.parse(timestamp);
    if (!Number.isFinite(ms)) return '–';
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Clock time with seconds ("02:13:05"). */
  function clock(timestamp) {
    const ms = Date.parse(timestamp);
    return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString() : '–';
  }

  function stateText(state) {
    const key = `components.guider.native.states.${state}`;
    return state && te(key) ? t(key) : state || '–';
  }

  return {
    t,
    te,
    k,
    kind,
    kinds,
    likely,
    dateTime,
    clock,
    stateText,
    cause: (cause, message) => causeText({ t, te }, cause, message),
    evidence: (item) => evidenceText({ t, te }, item),
    endReason: (reason) => endReasonText({ t, te }, reason),
    marker: (type) => markerTypeText({ t, te }, type),
  };
}

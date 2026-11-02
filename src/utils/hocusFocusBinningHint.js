// Hocus Focus builds its detection-binning recommendation as English text on the server
// (DetectionBinningResolver.DescribeRecommendation / DescribeRecommendationDetail) and sends no
// raw values beside it. These helpers recognise the known sentences and rebuild them from
// locale keys; anything they do not recognise is returned unchanged, so a wording change in a
// newer Hocus Focus falls back to its English text instead of disappearing.

// The server formats with CurrentCulture, so the decimal separator may be a comma.
const NUM = '(\\d+(?:[.,]\\d+)?)';
const KEY = 'components.focuser.hocus.binningHint';

const toNumber = (s) => Number(s.replace(',', '.'));
const fmt = (n) => n.toFixed(1);

export function translateBinningHint(text, t) {
  if (typeof text !== 'string') return text;
  const s = text.trim();
  if (s === 'Run an auto-focus to get a recommendation') return t(`${KEY}.none`);

  let m = s.match(new RegExp(`^Measured in-focus HFR ${NUM} px - (\\d)x\\2 recommended$`));
  if (m) return t(`${KEY}.recommended`, { hfr: fmt(toNumber(m[1])), factor: m[2] });

  m = s.match(new RegExp(`^Measured in-focus HFR ${NUM} px - below the 2-4 px range$`));
  if (m) return t(`${KEY}.below`, { hfr: fmt(toNumber(m[1])) });

  m = s.match(new RegExp(`^Measured in-focus HFR ${NUM} px - (\\d)x\\2 is right$`));
  if (m) return t(`${KEY}.right`, { hfr: fmt(toNumber(m[1])), factor: m[2] });

  return text;
}

export function translateBinningDetail(text, t) {
  if (typeof text !== 'string') return text;
  const s = text.trim();
  if (s.startsWith('Nothing measured yet.')) return t(`${KEY}.detail.none`);

  // The timestamp is optional and stays in the server's own date format.
  const when = s.match(/^Measured (?:(.+?) )?from your last auto-focus, in captured pixels\./);
  if (!when) return text;

  let reasoning;
  let m = s.match(
    new RegExp(`at ${NUM} px, binning (\\d)x\\2 for detection brings that to about ${NUM} px\\.`)
  );
  if (m) {
    reasoning = t(`${KEY}.detail.recommended`, {
      hfr: fmt(toNumber(m[1])),
      factor: m[2],
      binned: fmt(toNumber(m[3])),
    });
  } else if ((m = s.match(new RegExp(`and ${NUM} px is below that range\\.`)))) {
    reasoning = t(`${KEY}.detail.below`, { hfr: fmt(toNumber(m[1])) });
  } else if ((m = s.match(new RegExp(`and ${NUM} px is already in that range`)))) {
    reasoning = t(`${KEY}.detail.right`, { hfr: fmt(toNumber(m[1])) });
  } else {
    return text;
  }

  const measured = when[1]
    ? t(`${KEY}.detail.measuredAt`, { when: when[1] })
    : t(`${KEY}.detail.measured`);
  return `${measured} ${reasoning} ${t(`${KEY}.detail.rigChange`)}`;
}

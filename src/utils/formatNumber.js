// Decimal numbers in the app language's format: "2,99" in German, "2.99" in English.
// toFixed() always writes a point, which reads as a foreign number in most of the app's
// languages. Grouping stays off: these are measurements (HFR, °C, ″/px), not counts.

/**
 * `value` with exactly `digits` decimals in the given Intl locale (e.g. 'de-DE'); undefined
 * falls back to the runtime's locale. '' for anything that is not a finite number.
 */
export function formatDecimal(value, digits, intlLocale) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(n);
}

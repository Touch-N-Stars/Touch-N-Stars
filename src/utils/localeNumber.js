// formatDecimal() in the app's current language. Reads the global i18n locale, so a computed
// or template that calls it updates when the user switches the language.
import i18n, { getBackendLanguageCode } from '@/i18n';
import { formatDecimal } from './formatNumber';

export function localDecimal(value, digits = 2) {
  return formatDecimal(
    value,
    digits,
    getBackendLanguageCode(i18n.global.locale.value) ?? undefined
  );
}

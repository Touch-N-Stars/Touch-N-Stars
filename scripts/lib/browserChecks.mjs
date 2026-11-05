// vue-i18n renders a missing key as the key itself, for example `components.foo.bar`.
const RAW_I18N_KEY_RE =
  /(?<![\w./-])(?:app|common|components|dialogs|general|indi|nav|pages|pinsDevices|plugins|setup)(?:\.[A-Za-z_][\w-]*){2,}(?![\w/-])/g;

export function findPageProblems({ text, scrollWidth, viewportWidth, exceptions }) {
  const problems = exceptions.map((exception) => `exception: ${exception.split('\n')[0]}`);

  if (!text.trim()) problems.push('page is empty');

  const rawKeys = [...new Set(text.match(RAW_I18N_KEY_RE) ?? [])];
  if (rawKeys.length > 0) problems.push(`untranslated keys: ${rawKeys.join(', ')}`);

  if (scrollWidth > viewportWidth) {
    problems.push(`horizontal overflow: ${scrollWidth}px in a ${viewportWidth}px viewport`);
  }

  return problems;
}

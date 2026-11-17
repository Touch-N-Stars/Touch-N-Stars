// Question marks inside words/runs are characteristic of lossy ANSI writes.
// Legitimate question punctuation (including inverted Spanish marks) is allowed.
export function hasDamagedLocaleText(value) {
  return (
    typeof value === 'string' &&
    (/\?{2,}|\p{L}\?\p{L}|\uFFFD/u.test(value) ||
      /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC|\u00F0\u0178/u.test(value))
  );
}

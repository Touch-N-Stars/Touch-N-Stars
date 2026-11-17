// Rate limiting cache for duplicate messages
const errorCache = new Map();

/**
 * Creates structured log entries with rate limiting
 * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
 * @param {string} category - Category (API, HTTP, NETWORK, PERFORMANCE)
 * @param {Object} data - Log data
 * @returns {Object} Log entry
 */
export function createStructuredLog(level, category, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level,
    category: category,
    method: data.method || 'UNKNOWN',
    url: data.url || 'unknown',
    status: data.status,
    message: data.message,
    duration: data.duration,
    userAgent: navigator.userAgent.split(' ').pop(), // Simplified UA
    ...data.extra,
  };

  // Rate limiting: prevent spam of identical messages
  const cacheKey = `${level}:${category}:${data.method}:${data.url}:${data.status}:${data.message}`;
  const now = Date.now();

  if (errorCache.has(cacheKey)) {
    const lastLogged = errorCache.get(cacheKey);
    // Skip if same message was logged within last 5 seconds
    if (now - lastLogged < 5000) {
      return logEntry; // Return entry but don't log
    }
  }

  // Drop entries older than 30 seconds. Pruning here instead of with a timer
  // per logged message keeps no timers pending between log calls.
  for (const [key, timestamp] of errorCache) {
    if (now - timestamp > 30000) {
      errorCache.delete(key);
    }
  }

  // Update cache and log
  errorCache.set(cacheKey, now);

  // Route to the matching console method so errors/warnings stand out (in
  // devtools and in the captured log download) instead of hiding among the
  // regular console.log noise. Swallowed network failures are logged as ERROR
  // here, so this is what makes them findable after the fact.
  const consoleMethod =
    level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  consoleMethod(JSON.stringify(logEntry));

  return logEntry;
}

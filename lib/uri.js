/**
 * Utility to resolve prefixed values to full URIs using JSON-LD context.
 * Caches context objects by context URL to avoid repeated fetching/parsing.
 */
const contextCache = new Map();

/**
 * Fetches and caches the context object if needed.
 * @param {string|object} context - The @context value from the JSON-LD.
 * @returns {Promise<object|null>} The resolved context object or null.
 */
export async function getContextObject(context) {
  if (!context) return null;
  if (typeof context === 'object') return context;

  // If context is a URL, check cache first
  if (typeof context === 'string') {
    if (contextCache.has(context)) {
      return contextCache.get(context);
    }
    // Fetch and cache the context
    const res = await fetch(context);
    if (!res.ok) return null;
    const obj = await res.json();
    contextCache.set(context, obj);
    return obj;
  }
  return null;
}

/**
 * Resolves a prefixed value (e.g. "cont:1234") to its full URI using the @context from a JSON-LD object.
 * Caches context objects for performance.
 * @param {string} value - The prefixed value (e.g. "cont:1234").
 * @param {object} jsonld - The JSON-LD object containing the @context.
 * @returns {Promise<string|null>} The full URI, or null if it cannot be resolved.
 */
export async function fullUri(value, jsonld) {
  if (!value || typeof value !== 'string') return null;
  if (!jsonld || !jsonld['@context']) return null;

  // If already a full URI, return as is
  if (/^https?:\/\//.test(value)) return value;

  // Get context object (may be a URL or an object)
  const contextObj = await getContextObject(jsonld['@context']);
  if (!contextObj) return null;

  // If context is an array, merge all objects
  let context = contextObj;
  if (Array.isArray(contextObj)) {
    context = Object.assign({}, ...contextObj.filter((c) => typeof c === 'object'));
  }

  // Split prefix:value
  const [prefix, suffix] = value.split(':');
  if (!prefix || !suffix) return null;

  const base = context[prefix];
  if (!base) return null;

  // If base ends with / or #, just append, else add /
  if (base.endsWith('/') || base.endsWith('#')) {
    return `${base}${suffix}`;
  } else {
    return `${base}/${suffix}`;
  }
}

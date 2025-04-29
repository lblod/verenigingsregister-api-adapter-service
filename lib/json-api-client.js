const RESOURCE_NAMES = [
  // 'files',
  'addresses',
  // 'users',
  // 'accounts',
  'organizations',
  'associations',
  'persons',
  'memberships',
  'administrative-units',
  'governing-bodies',
  'identifiers',
  'structured-identifiers',
  // 'administrative-unit-classification-codes',
  // 'organization-status-codes',
  'sites',
  'contact-points',
  // 'site-types',
  // 'postal-codes',
  'activities',
  // 'changes',
  // 'change-events',
  // 'concepts',
  // 'concept-schemes',
  // 'target-audiences',
  // 'recognitions',
  // 'periods',
];

/**
 * JSONApiClient
 * Provides resource-specific CRUD methods for each resource in RESOURCE_NAMES.
 */
export default class JSONApiClient {
  /** @param {string} baseUrl */
  constructor(baseUrl = 'http://resource/') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  _endpoint(resourceName, id) {
    const path = `/${resourceName}`;
    return id != null ? `${this.baseUrl}${path}/${encodeq1URIComponent(id)}` : `${this.baseUrl}${path}`;
  }

  async _request(url, method, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
    }
    return res.status === 204 ? null : res.json();
  }

  _formatRelationships(rels) {
    return Object.entries(rels).reduce((acc, [k, v]) => {
      acc[k] = { data: v };
      return acc;
    }, {});
  }

  async _list(resourceName, params = {}) {
    const url = new URL(this._endpoint(resourceName));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return this._request(url.toString(), 'GET');
  }

  async _get(resourceName, id, params = {}) {
    const url = new URL(this._endpoint(resourceName, id));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return this._request(url.toString(), 'GET');
  }

  async _create(resourceName, attributes, relationships = {}) {
    const payload = { data: { type: resourceName, attributes } };
    if (Object.keys(relationships).length) payload.data.relationships = this._formatRelationships(relationships);
    return this._request(this._endpoint(resourceName), 'POST', payload);
  }

  async _update(resourceName, id, attributes, relationships = {}) {
    const payload = { data: { type: resourceName, id: String(id), attributes } };
    if (Object.keys(relationships).length) payload.data.relationships = this._formatRelationships(relationships);
    return this._request(this._endpoint(resourceName, id), 'PATCH', payload);
  }

  async _delete(resourceName, id) {
    return this._request(this._endpoint(resourceName, id), 'DELETE');
  }
}

// Helper to convert names to PascalCase for method naming
function toPascalCase(s) {
  return s
    .split(/[-_]/)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

// Attach resource-specific methods to the prototype
RESOURCE_NAMES.forEach((name) => {
  const C = toPascalCase(name);
  const proto = JSONApiClient.prototype;

  proto[`list${C}`] = function (params) {
    return this._list(name, params);
  };
  proto[`get${C}`] = function (id, params) {
    return this._get(name, id, params);
  };
  proto[`create${C}`] = function (attrs, rels) {
    return this._create(name, attrs, rels);
  };
  // proto[`update${C}`] = function (id, attrs, rels) {
  //   return this._update(name, id, attrs, rels);
  // };
  // proto[`delete${C}`] = function (id) {
  //   return this._delete(name, id);
  // };
});

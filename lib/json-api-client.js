import { RESOURCES_HOST } from "../constants";

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
  constructor(baseUrl = RESOURCES_HOST) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  _endpoint(resourceName, id) {
    const path = `/${resourceName}`;
    return id != null ? `${this.baseUrl}${path}/${encodeURIComponent(id)}` : `${this.baseUrl}${path}`;
  }

  async _request(url, method, body, extraHeaders = {}) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
        ...extraHeaders,
      },
    };

    // log curl command for debugging, inclding headers
    const curl = `curl -X ${method} '${url}' -H 'Content-Type: application/vnd.api+json' -H 'Accept: application/vnd.api+json' ${Object.entries(
      opts.headers
    )
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ')} ${body ? `-d '${JSON.stringify(body)}'` : ''}`;
    console.log('CURL', curl);


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

  async _list(resourceName, params = {}, extraHEaders = {}) {
    const url = new URL(this._endpoint(resourceName));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return this._request(url.toString(), 'GET', null, extraHEaders);
  }

  async _get(resourceName, id, params = {}, extraHeaders = {}) {
    const url = new URL(this._endpoint(resourceName, id));
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return this._request(url.toString(), 'GET', null, extraHeaders);
  }

  async _create(resourceName, attributes, relationships = {}, extraHeaders = {}) {
    const payload = { data: { type: resourceName, attributes } };
    if (Object.keys(relationships).length) payload.data.relationships = this._formatRelationships(relationships);
    return this._request(this._endpoint(resourceName), 'POST', payload, extraHeaders);
  }

  async _update(resourceName, id, attributes, relationships = {}, extraHeaders = {}) {
    const payload = { data: { type: resourceName, id: String(id), attributes } };
    if (Object.keys(relationships).length) payload.data.relationships = this._formatRelationships(relationships);
    return this._request(this._endpoint(resourceName, id), 'PATCH', payload, extraHeaders);
  }

  async _delete(resourceName, id, extraHeaders = {}) {
    return this._request(this._endpoint(resourceName, id), 'DELETE', null, extraHeaders);
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

  proto[`list${C}`] = function (params, extraHeaders) {
    return this._list(name, params, extraHeaders);
  };
  proto[`get${C}`] = function (id, params, extraHeaders) {
    return this._get(name, id, params, extraHeaders);
  };
  proto[`create${C}`] = function (attrs, rels, extraHeaders) {
    return this._create(name, attrs, rels, extraHeaders);
  };
  proto[`update${C}`] = function (id, attrs, rels, extraHeaders) {
    return this._update(name, id, attrs, rels, extraHeaders);
  };
  proto[`delete${C}`] = function (id, extraHeaders) {
    return this._delete(name, id, extraHeaders);
  };
});

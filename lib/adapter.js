import { VerenigingenApiClient } from "./verenigingen-api-client";
import { JSONApiClient } from "./json-api-client";
import { getAccessToken } from "./authenticate";
import { API_URL, API_VERSION } from "../constants";

export class Adapter {
  constructor() {
    this.beheersAPIClient = new VerenigingenApiClient(
      getAccessToken(),
      API_URL,
      API_VERSION,
      "ABB"
    );
    this.jsonapi = new JSONApiClient()
  }

  async getVereniging(id) {
    return this.client.getVereniging(id);
  }

  async updateVereniging(id, data, eTag) {
    return this.client.updateVereniging(id, data, eTag);
  }

  async addContactgegeven(id, contactgegeven, eTag) {
    return this.client.addContactgegeven(id, contactgegeven, eTag);
  }

  async updateContactgegeven(contactgegevenId, contactgegeven, eTag) {
    // Get the id of the association linked to the contact
    const params = {
      'include': 'identifiers.structured-identifier,contact-points',
      'filter[contact-points][:id:]': contactgegevenId,
    };
    const associations = await this.jsonapi.listAssociation(params);
    // Check if there's exactly one association inside the data array
    if (!associations.data || associations.data.length !== 1) {
      throw new Error('Expected exactly one association');
    }

    const association = associations.data[0];
    const vCode = this.extractVCode(association);

    if (!vCode) {
      throw new Error('No vCode found in the association response');
    }

    const vereniging = await this.beheersAPIClient.getVereniging(vCode);

    // find the relevant id of the contactgegeven, and the e-tag
    return this.client.updateContactgegeven(vCode, contactgegevenId, contactgegeven, eTag);
  }


  /**
   * Extracts the vCode (local-id) from a JSON:API association response.
   * @param {object} response - The parsed JSON response object.
   * @returns {string|null} The local-id of the vCode identifier, or null if not found.
   */
  extractVCode(response) {
    // Get the "included" array from the response
    const included = response.included || [];

    // Find the identifier object with type "identifiers" and id-name "vCode"
    const identifier = included.find(item => 
      item.type === 'identifiers' &&
      item.attributes &&
      item.attributes['id-name'] === 'vCode'
    );

    if (!identifier || !identifier.relationships || !identifier.relationships['structured-identifier']) {
      return null;
    }

    // Get the structured-identifier linkage
    const structuredLink = identifier.relationships['structured-identifier'].data;
    if (!structuredLink || !structuredLink.id) {
      return null;
    }
    const structuredId = structuredLink.id;

    // Find the structured-identifiers object by its ID
    const structured = included.find(item => 
      item.type === 'structured-identifiers' &&
      item.id === structuredId
    );

    // Return the local-id attribute if present
    return structured && structured.attributes ? structured.attributes['local-id'] : null;
  }

}

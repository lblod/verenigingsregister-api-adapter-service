import { VerenigingenApiClient } from './verenigingen-api-client';
import JSONApiClient from './json-api-client.js';
import { Authenticator } from './authenticator';
import { API_URL, API_VERSION } from '../constants';

export class Adapter {
  constructor() {
    this.jsonapi = new JSONApiClient();
    this.beheersAPIClient = new VerenigingenApiClient(new Authenticator(), API_URL, API_VERSION, 'ABB');

    this.pathsToAssociation = {
      associationContactPoint: '[contact-points]',
      primarySiteAddress: '[primary-site][contact-points]',
    };
  }

  async getVereniging(id) {
    return this.client.getVereniging(id);
  }

  async updateVereniging(id, data) {
    return this.client.updateVereniging(id, data);
  }

  async addContactgegeven(id, contactgegeven) {
    return this.client.addContactgegeven(id, contactgegeven, eTag);
  }

  async updateContactgegeven(contactgegevenId, contactgegeven) {
    // Get the id of the association linked to the contact
    // For now, we assume that the contactgegeven is linked to a vereniging.
    // In the future, we might need to check if it's linked to a contactgegeven.
    // Get the id of the association linked to the contact
    const vCode = await this.findAssociationLocally(contactgegevenId, this.pathsToAssociation.associationContactPoint);

    const vereniging = await this.beheersAPIClient.getVereniging(vCode);

    // find the relevant id of the contactgegeven, and the e-tag
    return null; //this.client.updateContactgegeven(vCode, contactgegevenId, contactgegeven, eTag);
  }

  async updateAddress(id, address) {
    // An address can be linked to a vereniging or a contactgegeven.
    // Get the id of the association linked to the address
    // For now, we assume that the address is linked to a vereniging.
    // In the future, we might need to check if it's linked to a contactgegeven.
    let vCode = await this.findAssociationLocally(id, this.pathsToAssociation.primarySiteAddress);

    return null; //this.beheersAPIClient.updateVereniging(vCode, { address });
  }

  async findAssociationLocally(id, jsonApiPath) {
    // Get the id of the association linked to the contact
    const params = {
      include: 'identifiers.structured-identifier,contact-points',
      [`filter${jsonApiPath}[:id:]`]: id,
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

    return vCode;
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
    const identifier = included.find(
      (item) => item.type === 'identifiers' && item.attributes && item.attributes['id-name'] === 'vCode'
    );

    if (!identifier?.relationships?.['structured-identifier']) {
      return null;
    }

    // Get the structured-identifier linkage
    const structuredLink = identifier.relationships['structured-identifier'].data;
    if (!structuredLink?.id) {
      return null;
    }
    const structuredId = structuredLink.id;

    // Find the structured-identifiers object by its ID
    const structured = included.find((item) => item.type === 'structured-identifiers' && item.id === structuredId);

    // Return the local-id attribute if present
    return structured?.attributes?.['local-id'] || null;
  }
}

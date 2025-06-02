import { VerenigingenApiClient } from './verenigingen-api-client';
import JSONApiClient from './json-api-client.js';
import { Authenticator } from './authenticator';
import { API_URL, API_VERSION } from '../constants';
import { ADDRESS_MAPPING } from './mappings.js';

export class Adapter {
  constructor() {
    this.jsonapi = new JSONApiClient();
    this.beheersAPIClient = new VerenigingenApiClient(new Authenticator(), API_URL, API_VERSION, 'ABB');

    this.pathsToAssociation = {
      associationContactPoint: '[contact-points]',
      primarySiteAddress: '[primary-site][address]',
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

    console.log('vereniging', JSON.stringify(vereniging, null, 2));

    // find the relevant id of the contactgegeven, and the e-tag
    return null; //this.client.updateContactgegeven(vCode, contactgegevenId, contactgegeven, eTag);
  }

  async deleteAddress(id, muHeaders) {
    let vCode = await this.findAssociationLocally(id, this.pathsToAssociation.primarySiteAddress, muHeaders);
    const verenigingResponse = await this.beheersAPIClient.getVereniging(vCode);
    const vereniging = verenigingResponse.data;
    const eTag = verenigingResponse.headers['etag'];
    console.log('vereniging', JSON.stringify(vereniging, null, 2));
    // find the relevant id of the contactgegeven, and the e-tag
    const primaryLocation = this.getPrimaryLocation(vereniging);
    console.log('primaryLocation', JSON.stringify(primaryLocation, null, 2));
    const locatieId = primaryLocation['locatieId'];
    console.log('locatieId', JSON.stringify(locatieId, null, 2));

    this.compareValues(
      (await this.jsonapi.getAddresses(id, {}, muHeaders)).data.attributes,
      primaryLocation.adres,
      ADDRESS_MAPPING
    );

    this.beheersAPIClient.deleteVerenigingAddress(vCode, locatieId, eTag);
    return this.jsonapi.deleteAddress(id, muHeaders);
  }

  async updateAddress(id, address, muHeaders) {
    // An address can be linked to a vereniging or a contactgegeven.
    // Get the id of the association linked to the address
    // For now, we assume that the address is linked to a vereniging.
    // In the future, we might need to check if it's linked to a contactgegeven.
    let vCode = await this.findAssociationLocally(id, this.pathsToAssociation.primarySiteAddress, muHeaders);

    const verenigingResponse = await this.beheersAPIClient.getVereniging(vCode);
    const vereniging = verenigingResponse.data;
    const eTag = verenigingResponse.headers['etag'];

    console.log('vereniging', JSON.stringify(vereniging, null, 2));

    // local address before change
    const localAddressBeforeChange = (await this.jsonapi.getAddresses(id, {}, muHeaders)).data;
    console.log('localAddressBeforeChange', JSON.stringify(localAddressBeforeChange, null, 2));


    // Compare the address with the verenigingsregister response
    const primaryLocation = this.getPrimaryLocation(vereniging);

    console.log('primaryLocation', JSON.stringify(primaryLocation, null, 2));

    this.compareValues(
      localAddressBeforeChange.attributes,
      primaryLocation.adres,
      ADDRESS_MAPPING
    );

    const locatieId = primaryLocation['locatieId'];

    console.log('locatieId', JSON.stringify(locatieId, null, 2));

    // update the address in the verenigingsregister, add the e-tag

    const newAddress = this.mapValues(address, ADDRESS_MAPPING);

    console.log('newAddress', JSON.stringify(newAddress, null, 2));

    // update locally






    return null; //this.beheersAPIClient.updateVereniging(vCode, { address });
  }

  async findAssociationLocally(id, jsonApiPath, muHeaders) {
    // Get the id of the association linked to the contact
    const params = {
      include: 'identifiers.structured-identifier,contact-points',
      [`filter${jsonApiPath}[:id:]`]: id,
    };

    const associations = await this.jsonapi.listAssociations(params, muHeaders);
    // Check if there's exactly one association inside the data array
    if (!associations.data || associations.data.length !== 1) {
      console.error('Unexpected response:', JSON.stringify(associations, null, 2));
      throw new Error('Expected exactly one association');
    }

    const vCode = this.extractVCode(associations);

    if (!vCode) {
      console.error('Unexpected response:', JSON.stringify(associations, null, 2));
      throw new Error('No vCode found in the association response');
    }

    console.log('Found association locally:', vCode);

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

  /**
   * Get the primary location of a vereniging.
   * Same logic as in harvest_scraper
   * https://github.com/lblod/harvesting-verenigingen-scraper-service/blob/cca12ce0ebf1b8d7b9da78aa7431c77446fdfce8/lblod/transform_data.py
   **/
  getPrimaryLocation(vereniging) {
    const locaties = vereniging?.vereniging?.locaties || [];

    console.log('locaties', JSON.stringify(locaties, null, 2));

    let primaryLocation = null;

    // 1. Check for 'isPrimair: true'
    for (const locatie of locaties) {
      if (locatie.isPrimair) {
        primaryLocation = locatie;
        break;
      }
    }

    // 2. If not found, check for 'Maatschappelijke zetel volgens KBO'
    if (!primaryLocation) {
      for (const locatie of locaties) {
        if (locatie.locatietype === "Maatschappelijke zetel volgens KBO") {
          primaryLocation = locatie;
          break;
        }
      }
    }

    // 3. If not found, check for 'Correspondentie'
    if (!primaryLocation) {
      for (const locatie of locaties) {
        if (locatie.locatietype === "Correspondentie") {
          primaryLocation = locatie;
          break;
        }
      }
    }

    // 4. Fallback: first location in the list
    if (!primaryLocation && locaties.length > 0) {
      primaryLocation = locaties[0];
    }

    return primaryLocation;
  }

  getMatchingLocations(vereniging, address) {
    const locaties = vereniging?.vereniging?.locaties || [];

    console.log('locaties', JSON.stringify(locaties, null, 2));

    const matchingLocations = [];

    for (const locatie of locaties) {
      if (this.compareValues(locatie.adres, address, ADDRESS_MAPPING)) {
        matchingLocations.push(locatie);
      }
    }

    return matchingLocations;
  }

  compareValues(localValue, registerValue, mapping) {
    // Check if the local value is in the mapping
    console.log('Make sure the local stored value does not conflict with the latest value from the register');
    for (const [localKey, registerKey] of Object.entries(mapping)) {
      if (localValue[localKey] !== undefined && registerValue[registerKey] !== undefined) {
        if (localValue[localKey] !== registerValue[registerKey]) {
          console.log(`Mismatch for ${localKey}: local=${localValue[localKey]}, register=${registerValue[registerKey]}`);
          return false;
        } else {
          console.log(`  Match for ${localKey}: ${localValue[localKey]}`);
        }
      } else {
        console.log(`  Key ${localKey} not found in local or register value - ignored`);
      }
    }
    console.log('  No mismatches found');
    return true;
  }

  mapValues(newValues, mapping) {
    const mappedValues = {};
    for (const [localKey, registerKey] of Object.entries(mapping)) {
      if (newValues[localKey] !== undefined) {
        mappedValues[registerKey] = newValues[localKey];
      }
    }
    return mappedValues;
  }
}

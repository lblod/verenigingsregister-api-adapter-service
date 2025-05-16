import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class VerenigingenApiClient {
  /**
   * @param {object} authenticator - An object with a getAccessToken() method
   * @param {string} baseURL
   * @param {string|null} apiVersion
   * @param {string} vrInitiator
   */
  constructor(
    authenticator,
    baseURL = 'http://beheer.verenigingen.vlaanderen.be',
    apiVersion = null,
    vrInitiator = 'your_initiator'
  ) {
    if (!authenticator || typeof authenticator.getAccessToken !== 'function') {
      throw new Error('Authenticator with getAccessToken() is required');
    }
    this.client = axios.create({ baseURL });
    this.apiVersion = apiVersion;
    this.vrInitiator = vrInitiator;
    this.authenticator = authenticator;
  }

  async _headers(extraHeaders = {}) {
    let accessToken;
    try {
      accessToken = await this.authenticator.getAccessToken();
    } catch (err) {
      console.error('Error retrieving access token:', err);
      throw new Error('Unable to retrieve access token');
    }

    console.log('Access token retrieved successfully');
    console.log('Access token:', accessToken);


    return {
      Authorization: `Bearer ${accessToken}`,
      'x-correlation-id': uuidv4(),
      // 'VR-Initiator': this.vrInitiator,
      ...(this.apiVersion && { 'vr-api-version': this.apiVersion }),
      ...extraHeaders,
    };
  }

  async getVereniging(vCode) {
    // log axios request
    console.log('GET', `/verenigingen/${vCode}`, {
      headers: await this._headers(),
      url: this.client.defaults.baseURL + `/${vCode}`,
    });
    const response = await this.client.get(`/verenigingen/${vCode}`, { headers: await this._headers() });
    console.log('Response', response.data);
    console.log('Response status', response.status);
    console.log('Response headers', response.headers['etag']);
    if (response.status === 200) {
      return response;
    } else {
      throw new Error(`Failed to fetch vereniging: HTTP ${response.status}`);
    }
  }

  async updateVereniging(vCode, data, eTag) {
    return this.client.patch(`/v1/verenigingen/${vCode}`, data, {
      headers: await this._headers({ 'If-Match': eTag }),
    });
  }

  async addContactgegeven(vCode, contactgegeven, eTag) {
    return this.client.post(
      `/v1/verenigingen/${vCode}/contactgegevens`,
      { contactgegeven },
      {
        headers: await this._headers({ 'If-Match': eTag }),
      }
    );
  }

  async updateContactgegeven(vCode, contactgegevenId, contactgegeven, eTag) {
    return this.client.patch(
      `/v1/verenigingen/${vCode}/contactgegevens/${contactgegevenId}`,
      { contactgegeven },
      {
        headers: await this._headers({ 'If-Match': eTag }),
      }
    );
  }

  async deleteContactgegeven(vCode, contactgegevenId, eTag) {
    return this.client.delete(`/v1/verenigingen/${vCode}/contactgegevens/${contactgegevenId}`, {
      headers: await this._headers({ 'If-Match': eTag }),
    });
  }

  async getHistoriek(vCode) {
    return this.client.get(`/v1/verenigingen/${vCode}/historiek`, {
      headers: await this._headers(),
    });
  }

  async updateVerenigingKbo(vCode, data, eTag) {
    return this.client.patch(`/v1/verenigingen/${vCode}/kbo`, data, {
      headers: await this._headers({ 'If-Match': eTag }),
    });
  }

  async updateContactgegevenKbo(vCode, contactgegevenId, contactgegeven, eTag) {
    return this.client.patch(
      `/v1/verenigingen/${vCode}/kbo/contactgegevens/${contactgegevenId}`,
      { contactgegeven },
      {
        headers: await this._headers({ 'If-Match': eTag }),
      }
    );
  }

  async updateMaatschappelijkeZetel(vCode, locatieId, locatie, eTag) {
    return this.client.patch(
      `/v1/verenigingen/${vCode}/kbo/locaties/${locatieId}`,
      { locatie },
      {
        headers: await this._headers({ 'If-Match': eTag }),
      }
    );
  }

  async addLidmaatschap(vCode, lidmaatschap, eTag) {
    return this.client.post(`/v1/verenigingen/${vCode}/lidmaatschappen`, lidmaatschap, {
      headers: await this._headers({ 'If-Match': eTag }),
    });
  }
}

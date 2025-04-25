import fs from 'fs';
import path from 'path';
import glob from 'glob';
import jwt from 'jsonwebtoken';
import http from 'http';
import { randomUUID } from 'crypto';
import { CLIENT_ID, ENVIRONMENT, AUD, HOST, SCOPE, AUTHORIZATION_KEY } from './constants.js';

let authHealthStatus = {
  status: 'unknown',
  lastChecked: null,
  details: {},
};

function setAuthHealthStatus(status, details = {}) {
  authHealthStatus = {
    status,
    lastChecked: new Date(),
    details,
  };
  console.log('Auth Health Status:', authHealthStatus);
}

async function getAuthHealthStatus() {
  return authHealthStatus;
}

async function getAccessToken() {
  if (ENVIRONMENT !== 'PROD') {
    const authorizationKey = AUTHORIZATION_KEY;
    if (!authorizationKey) {
      console.error('Error: AUTHORIZATION_KEY environment variable is not defined.');
      setAuthHealthStatus('ERROR', { message: 'AUTHORIZATION_KEY is missing' });
      throw new Error('AUTHORIZATION_KEY environment variable is required but not defined.');
    }
    const url = new URL(`${aud}/v1/token`);
    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: SCOPE,
    }).toString();

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + authorizationKey,
      },
    };

    return new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body).access_token);
          } else {
            console.error('Error:', res.statusCode);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error:', error.message);
        setAuthHealthStatus('ERROR', { message: error.message, environment: environment, host: HOST });
        reject(null);
      });

      req.write(data);
      req.end();
    });
  } else {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 9 * 60; // 9 minutes from now

    const payload = {
      iss: CLIENT_ID,
      sub: CLIENT_ID,
      aud: AUD,
      exp: exp,
      jti: randomUUID(),
      iat: iat,
    };

    const keyTest = getKeyFromConfig('/config');

    if (keyTest) {
      const token = jwt.sign(payload, keyTest, { algorithm: 'RS256' });

      const url = new URL(`https://${HOST}/op/v1/token`);
      const data = new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        scope: scope,
        client_assertion: token,
      }).toString();

      const options = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(body).access_token);
            } else {
              console.error('Error:', res.statusCode);
              resolve(null);
            }
          });
        });

        req.on('error', (error) => {
          console.error('Error:', error.message);
          setAuthHealthStatus('ERROR', { message: error.message, environment: environment, host: host });
          reject(null);
        });

        req.write(data);
        req.end();
      });
    }
  }
}

function getKeyFromConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`The specified directory does not exist: ${configPath}`);
    return null;
  }

  const keyFiles = glob.sync(path.join(configPath, '*.pem'));
  if (keyFiles.length === 0) {
    console.error(`No key files found in the specified directory: ${configPath}`);
    return null;
  }

  const keyFile = keyFiles[0];
  const key = fs.readFileSync(keyFile, 'utf8');
  return key;
}

export { getAccessToken, getAuthHealthStatus };

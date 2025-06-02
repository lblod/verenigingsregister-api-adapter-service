import { app } from 'mu';
import bodyParser from 'body-parser';
import { Adapter } from './lib/adapter.js';
import { EDITOR_ROLE } from './constants.js';

const adapter = new Adapter();

const HEADER_MU_SESSION_ID = 'mu-session-id';

const MU_REQUEST_HEADERS = [
  'mu-session-id',
  'mu-auth-allowed-groups'
];

const UNAUTHORIZED = {
  errors: [
    {
      status: '403',
      title: 'Forbidden',
      detail: `User must be a ${EDITOR_ROLE}`,
    },
  ],
}

// Helper function to check if the user is a verenigingen-beheerder
// This function checks the 'mu-auth-allowed-groups' header for the presence of 'verenigingen-beheerder'
// and returns true if found, false otherwise.
// Consider using a less hacky way to check for the presence of the group
function isVerenigingenBeheerder(mu_headers) {
  const groupsHeader = mu_headers['mu-auth-allowed-groups'];
  if (!groupsHeader) return false;
  try {
    const groups = JSON.parse(groupsHeader);
    return Array.isArray(groups) && groups.some(g => g.name === EDITOR_ROLE);
  } catch {
    return false;
  }
}

function getMuHeaders(req) {
  const muHeaders = {};
  for (const header of MU_REQUEST_HEADERS) {
    if (req.headers[header]) {
      muHeaders[header] = req.headers[header];
    }
  }
  return muHeaders;
}

// Add body parser middleware for JSON
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

app.get('/hello', function (req, res) {
  res.send('Hello verenigingsregister-api-adapter-service');
});

app.get('/health', function (req, res) {
  const healthStatus = health.checkHealth();
  res.status(healthStatus.status === 'OK' ? 200 : 503).json(healthStatus);
});

// JSON:API compliant route for updating an address
app.patch('/addresses/:id', async function (req, res) {
  try {
    const mu_headers = getMuHeaders(req);
    console.log('mu_headers', mu_headers);

    if (!isVerenigingenBeheerder(mu_headers)) {
      return res.status(403).json(UNAUTHORIZED);
    }

    // JSON:API validation
    if (!req.body.data || req.body.data.type !== 'addresses' || !req.body.data.id) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            title: 'Invalid request',
            detail: "Request must include data.type='addresses' and data.id",
          },
        ],
      });
    }

    const addressId = req.params.id;

    // Ensure ID in URL matches ID in request body
    if (addressId !== req.body.data.id) {
      return res.status(400).json({
        errors: [
          {
            status: '400',
            title: 'ID mismatch',
            detail: 'ID in URL must match ID in request body',
          },
        ],
      });
    }

    // Extract attributes from request body
    const attributes = req.body.data.attributes || {};
    const validAttributes = ['number', 'box-number', 'street', 'postcode', 'municipality', 'country'];

    // Filter to only include allowed attributes
    const addressData = {};
    for (const attr of validAttributes) {
      if (attributes[attr] !== undefined) {
        addressData[attr] = attributes[attr];
      }
    }

    return adapter
      .updateAddress(addressId, addressData, mu_headers)
      .then(() => {
        // If the update is successful, return the updated resource
        // write the returned value of updateAddress to the response
        // Assuming updateAddress returns the updated address data


        res.status(200).json({
          data: {
            type: 'addresses',
            id: addressId,
            attributes: addressData,
          },
        });
      })
      .catch((error) => {
        // Handle any errors that occur during the update
        res.status(500).json({
          errors: [
            {
              status: '500',
              title: 'Server error',
              detail: error.message,
            },
          ],
        });
      });
  } catch (error) {
    res.status(500).json({
      errors: [
        {
          status: '500',
          title: 'Server error',
          detail: error.message,
        },
      ],
    });
  }
});


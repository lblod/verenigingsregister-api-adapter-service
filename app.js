import { app } from 'mu';
import bodyParser from 'body-parser';
import { Adapter } from './lib/adapter.js';

const adapter = new Adapter();

const HEADER_MU_SESSION_ID = 'mu-session-id';

const MU_REQUEST_HEADERS = [
  'mu-session-id',
  'mu-auth-allowed-groups'
];

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
    const mu_headers = Object.fromEntries(
      Object.entries(req.headers).filter(([key]) => MU_REQUEST_HEADERS.includes(key))
    );
    console.log('mu_headers', mu_headers);

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

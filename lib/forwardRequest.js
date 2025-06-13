import { RESOURCES_HOST } from "../constants";

/**
 * Forwards an incoming Express request to the RESOURCES host.
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export async function forwardRequest(req, res) {
  try {
    const url = `${RESOURCES_HOST}${req.originalUrl}`;
    const method = req.method;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length']; // Fix the mismatch issue

    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
    const fetchOptions = {
      method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
    };

    const response = await fetch(url, fetchOptions);

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Forwarding failed:', err);
    res.status(502).send('Forwarding error');
  }
}

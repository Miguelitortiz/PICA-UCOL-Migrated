const BASE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:6770',
  professors: process.env.PROFESSORS_SERVICE_URL || 'http://professors-service:6771',
  academic: process.env.ACADEMIC_SERVICE_URL || 'http://academic-service:6772',
  reference: process.env.REFERENCE_SERVICE_URL || 'http://reference-service:6773',
};

// Simple basic credentials for internal microservice calls if needed
const basicAuthHeader = 'Basic ' + Buffer.from('admin:admin_pass').toString('base64');

export async function fetchFromService(service, path, options = {}) {
  const url = `${BASE_URLS[service]}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': basicAuthHeader,
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Service ${service} error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

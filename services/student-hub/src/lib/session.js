import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a 32-byte key from the secret using SHA-256
function getKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts and signs a session object
 * @param {object} data - The session data
 * @param {string} [secret] - The encryption secret
 * @returns {string} - The secure encrypted/signed token
 */
export function encryptSession(data, secret = process.env.COOKIE_SECRET || 'pica_session_fallback_secret_key_12345!') {
  const text = JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey(secret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Create HMAC signature over IV and ciphertext
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(iv.toString('hex') + ':' + encrypted);
  const signature = hmac.digest('hex');
  
  return iv.toString('hex') + ':' + encrypted + ':' + signature;
}

/**
 * Decrypts and verifies a session token
 * @param {string} token - The secure encrypted/signed token
 * @param {string} [secret] - The encryption secret
 * @returns {object|null} - The decrypted session object, or null if invalid
 */
export function decryptSession(token, secret = process.env.COOKIE_SECRET || 'pica_session_fallback_secret_key_12345!') {
  if (!token) return null;
  
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  
  const [ivHex, encryptedHex, signature] = parts;
  
  // Verify HMAC signature first
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(ivHex + ':' + encryptedHex);
  const expectedSignature = hmac.digest('hex');
  
  // Direct comparison is sufficient; timingSafeEqual can be used but requires matching lengths.
  // Using timingSafeEqual for security.
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Integrity check failed: invalid signature');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const key = getKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

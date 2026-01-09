import { createHmac, randomBytes } from 'crypto';

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = Buffer.alloc(Math.ceil(input.length * 5 / 8));

  for (let i = 0; i < input.length; i++) {
    const char = input[i].toUpperCase();
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    while (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return buffer.slice(0, index);
}

export function generateSecret(length: number = 20): string {
  const buffer = randomBytes(length);
  return base32Encode(buffer);
}

export function generateToken(secret: string, timeStep: number = 30): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const time = Buffer.alloc(8);
  
  // Write time as big-endian 64-bit integer
  const count = Math.floor(epoch / timeStep);
  time.writeBigInt64BE(BigInt(count), 0);

  const hmac = createHmac('sha1', key);
  hmac.update(time);
  const hash = hmac.digest();

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyToken(token: string, secret: string, window: number = 1): boolean {
  if (!token || !secret) return false;
  
  const currentEpoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const currentCount = Math.floor(currentEpoch / timeStep);

  for (let i = -window; i <= window; i++) {
    const count = currentCount + i;
    
    // Calculate hash for this specific time window
    const key = base32Decode(secret);
    const time = Buffer.alloc(8);
    time.writeBigInt64BE(BigInt(count), 0);
    
    const hmac = createHmac('sha1', key);
    hmac.update(time);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');

    if (otp === token) {
      return true;
    }
  }
  
  return false;
}

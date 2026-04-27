import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-phoenix-lab';

export const USN_REGEX = /^[1-4][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9]{2,3}$/;

export interface JwtPayload {
  userId: string;
  roleId: number;
  usn: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

export function isValidUSN(usn: string): boolean {
  return USN_REGEX.test(usn.toUpperCase());
}

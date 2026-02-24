import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-jwt-secret-min-32-chars-here!!'
);

export interface UserPayload {
  sub: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export async function createToken(payload: Omit<UserPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateUserId(): string {
  return uuidv4();
}

export function getDataServerUrl(path: string): string {
  const base = process.env.DATA_SERVER_URL || 'https://data.example.com/ai-schedule';
  return `${base}${path}`;
}

export function getInternalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Secret': process.env.API_SECRET || 'your-secret-key-here',
  };
}

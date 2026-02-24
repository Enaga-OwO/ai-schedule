import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-jwt-secret-min-32-chars-here!!'
);

export interface UserPayload {
  sub: string;      // userId
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

// JWTトークン生成
export async function createToken(payload: Omit<UserPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET);
}

// JWTトークン検証
export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as UserPayload;
  } catch {
    return null;
  }
}

// パスワードハッシュ化
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// パスワード検証
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ユーザーID生成
export function generateUserId(): string {
  return uuidv4();
}

// PHPサーバーのAPI URLを構築する共通関数
export function getDataServerUrl(path: string): string {
  const base = process.env.DATA_SERVER_URL || 'https://data.example.com/ai-schedule';
  return `${base}${path}`;
}

// PHPサーバーの内部APIヘッダー
export function getInternalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Secret': process.env.API_SECRET || 'your-secret-key-here',
  };
}

import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT 工具函数
 * 使用 jose 库（Edge Runtime 兼容）
 * 密钥从环境变量 JWT_SECRET 读取，开发态缺省 fallback
 */

const JWT_SECRET_KEY = process.env.JWT_SECRET || 'bz-training-dev-secret-key-2026';
const JWT_EXPIRES_IN = '24h';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_KEY);
}

export interface JWTPayload {
  userId: string;
  username: string;
  realName: string;
  role: string;
  stage: string;
  permissions: string[];
}

/**
 * 签发 JWT
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    realName: payload.realName,
    role: payload.role,
    stage: payload.stage,
    permissions: payload.permissions,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getSecret());
}

/**
 * 验证 JWT，返回 payload 或 null
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      realName: payload.realName as string,
      role: payload.role as string,
      stage: payload.stage as string,
      permissions: (payload.permissions as string[]) || [],
    };
  } catch {
    return null;
  }
}

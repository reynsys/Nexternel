import { resolveRoleInfo } from "./roles.js";
import { signAccessToken, signRefreshToken } from "./tokens.js";

/** New access and refresh tokens for this account, carrying its sign-in number (see token-version.ts). */
export async function tokensFor(
  user: { id: string; username: string; role: string; token_version?: number },
  tokenVersion = user.token_version ?? 0
) {
  const roleInfo = await resolveRoleInfo(user.role);
  const claims = {
    userId: user.id,
    username: user.username,
    role: roleInfo.slug,
    isAdmin: roleInfo.isAdmin,
    permissions: roleInfo.permissions,
    tokenVersion,
  };
  return {
    roleInfo,
    accessToken: await signAccessToken(claims),
    refreshToken: await signRefreshToken(claims),
  };
}

import { isPermission, type AuthUserResponse } from '@erp/types';
import type { ChangePasswordInput, LoginInput, ResetPasswordInput } from '@erp/validation';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { BadRequestError, AuthError, ForbiddenError, InternalError } from '../../shared/http/errors.js';
import { getDummyPasswordHash, hashPassword, verifyPassword } from '../../shared/security/password.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { generateRandomToken, hashToken } from '../../shared/security/token.js';
import { usersRepository } from '../users/users.repository.js';
import type { UserDocument } from '../users/users.model.js';
import { rolesRepository } from '../roles/roles.repository.js';
import { sessionsRepository } from './auth.sessions.repository.js';
import { passwordResetRepository } from './auth.password-reset.repository.js';
import type { AuthContext, AuthResult, RequestContext } from './auth.types.js';

const REFRESH_TOKEN_BYTES = 48;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function toAuthUserResponse(
  user: Pick<
    UserDocument,
    'id' | 'email' | 'firstName' | 'lastName' | 'companyId' | 'roleId' | 'isActive'
  >,
  rolePermissions: string[],
  roleName: string,
): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    companyId: user.companyId.toString(),
    roleId: user.roleId.toString(),
    roleName,
    // Filtra valores ajenos al catálogo: una BD alterada no puede ampliar permisos.
    permissions: rolePermissions.filter(isPermission),
    isActive: user.isActive,
  };
}

async function buildAuthResult(
  user: UserDocument,
  sessionSid: string,
): Promise<AuthResult> {
  const role = await rolesRepository.findByIdInCompany(
    user.companyId.toString(),
    user.roleId.toString(),
  );
  if (!role) {
    logger.error({ userId: user.id, roleId: String(user.roleId) }, 'Rol inexistente al autenticar');
    throw new InternalError('La configuración del usuario no es válida');
  }
  const accessToken = signAccessToken({
    sub: user.id,
    companyId: user.companyId.toString(),
    roleId: user.roleId.toString(),
    sid: sessionSid,
    typ: 'access',
  });
  return {
    user: toAuthUserResponse(user, role.permissions, role.name),
    accessToken,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshToken: '',
  };
}

export const authService = {
  /**
   * Login: valida credenciales, controla cuentas desactivadas y crea la sesión.
   * Respuesta idéntica para correo inexistente y contraseña incorrecta (sin enumeración).
   */
  async login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
    const candidates = await usersRepository.findCandidatesByEmail(input.email, input.companyId);
    const matches: UserDocument[] = [];

    if (candidates.length === 0) {
      // Equaliza el tiempo de respuesta cuando el correo no existe.
      await verifyPassword(input.password, await getDummyPasswordHash());
    } else {
      for (const candidate of candidates) {
        const ok = await verifyPassword(input.password, candidate.passwordHash);
        if (ok) matches.push(candidate);
      }
    }

    if (matches.length === 0) {
      logger.warn({ email: input.email, ip: ctx.ip }, 'Login fallido: credenciales inválidas');
      throw new AuthError('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
    }
    if (!input.companyId && matches.length > 1) {
      throw new AuthError('Indica el ID de la empresa para iniciar sesión', 'COMPANY_REQUIRED');
    }
    const matched = matches[0]!;
    if (!matched.isActive) {
      logger.warn({ userId: matched.id, ip: ctx.ip }, 'Login bloqueado: cuenta desactivada');
      throw new ForbiddenError('La cuenta está desactivada', 'ACCOUNT_DISABLED');
    }

    const refreshToken = generateRandomToken(REFRESH_TOKEN_BYTES);
    const session = await sessionsRepository.create({
      userId: matched.id,
      tokenHash: hashToken(refreshToken),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      expiresAt: refreshExpiry(),
    });
    await usersRepository.updateLastLogin(matched.id);

    const result = await buildAuthResult(matched, session.id);
    result.refreshToken = refreshToken;
    logger.info({ userId: matched.id, companyId: matched.companyId.toString() }, 'Login exitoso');
    return result;
  },

  /** Rotación del refresh token. El token anterior deja de ser válido inmediatamente. */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new AuthError('No se proporcionó una sesión válida', 'REFRESH_TOKEN_MISSING');
    }
    const session = await sessionsRepository.findByTokenHash(hashToken(refreshToken));
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('La sesión no es válida o ha expirado', 'SESSION_INVALID');
    }

    const user = await usersRepository.findById(session.userId.toString());
    if (!user) {
      await sessionsRepository.revoke(session);
      throw new AuthError('La sesión no es válida o ha expirado', 'SESSION_INVALID');
    }
    if (!user.isActive) {
      await sessionsRepository.revoke(session);
      throw new ForbiddenError('La cuenta está desactivada', 'ACCOUNT_DISABLED');
    }

    const newToken = generateRandomToken(REFRESH_TOKEN_BYTES);
    await sessionsRepository.rotate(session, hashToken(newToken), refreshExpiry(), new Date());

    const result = await buildAuthResult(user, session.id);
    result.refreshToken = newToken;
    return result;
  },

  /** Logout idempotente: revoca la sesión indicada (si existe) y limpia la cookie. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await sessionsRepository.revokeByTokenHash(hashToken(refreshToken));
    logger.info('Sesión revocada (logout)');
  },

  /** Devuelve el usuario autenticado a partir del contexto del middleware. */
  me(auth: AuthContext): AuthUserResponse {
    return {
      id: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      companyId: auth.user.companyId,
      roleId: auth.user.roleId,
      roleName: auth.user.roleName,
      permissions: auth.permissions,
      isActive: auth.user.isActive,
    };
  },

  /** Cambio de contraseña: valida la actual, actualiza el hash y revoca las demás sesiones. */
  async changePassword(auth: AuthContext, input: ChangePasswordInput): Promise<void> {
    const user = await usersRepository.findByIdWithPassword(auth.user.id);
    if (!user) {
      throw new AuthError('La sesión no es válida', 'SESSION_INVALID');
    }
    if (!user.isActive) {
      throw new ForbiddenError('La cuenta está desactivada', 'ACCOUNT_DISABLED');
    }

    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) {
      logger.warn({ userId: user.id }, 'Cambio de contraseña rechazado: contraseña actual incorrecta');
      throw new ForbiddenError('La contraseña actual es incorrecta', 'CURRENT_PASSWORD_INVALID');
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestError('La nueva contraseña debe ser distinta a la actual', 'PASSWORD_REUSE');
    }

    await usersRepository.updatePassword(user.id, await hashPassword(input.newPassword), new Date());
    await sessionsRepository.revokeAllForUser(user.id, auth.sessionId);
    logger.info({ userId: user.id }, 'Contraseña actualizada y demás sesiones revocadas');
  },

  /**
   * Solicitud de restablecimiento.
   * Siempre responde 200 (no revela si el correo existe).
   * Solo fuera de producción se devuelve `resetToken` (en producción el envío sería por correo).
   */
  async requestPasswordReset(email: string, companyId?: string): Promise<{ resetToken?: string }> {
    const candidates = (await usersRepository.findCandidatesByEmail(email, companyId))
      .filter((candidate) => candidate.isActive);
    // No emitir un enlace para una cuenta arbitraria cuando el correo se comparte entre empresas.
    const user = candidates.length === 1 ? candidates[0] : undefined;
    if (!user) {
      logger.info({ email, ambiguous: candidates.length > 1 }, 'Solicitud de restablecimiento para cuenta inexistente, inactiva o ambigua');
      return {};
    }

    const token = generateRandomToken();
    await passwordResetRepository.create(user.id, hashToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));
    logger.info({ userId: user.id }, 'Token de restablecimiento generado');

    if (env.NODE_ENV !== 'production') {
      return { resetToken: token };
    }
    return {};
  },

  /** Aplica el restablecimiento: un solo uso, expiración y revoca todas las sesiones. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await passwordResetRepository.findByTokenHash(hashToken(input.token));
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError(
        'El enlace de restablecimiento no es válido o ha expirado',
        'INVALID_RESET_TOKEN',
      );
    }

    const user = await usersRepository.findById(record.userId.toString());
    if (!user || !user.isActive) {
      throw new BadRequestError(
        'El enlace de restablecimiento no es válido o ha expirado',
        'INVALID_RESET_TOKEN',
      );
    }

    await usersRepository.updatePassword(user.id, await hashPassword(input.newPassword), new Date());
    await passwordResetRepository.markUsed(record);
    await sessionsRepository.revokeAllForUser(user.id);
    logger.info({ userId: user.id }, 'Contraseña restablecida y sesiones revocadas');
  },
};

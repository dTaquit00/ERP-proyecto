import type { Request, RequestHandler, Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@erp/validation';
import { env } from '../../config/env.js';
import { parseOrThrow } from '../../shared/http/parse.js';
import { requireAuth } from '../../shared/http/auth-req.js';
import { sendOk } from '../../shared/http/response.js';
import { authService } from './auth.service.js';
import type { RequestContext } from './auth.types.js';

const REFRESH_COOKIE = 'refreshToken';

function requestContext(req: Request): RequestContext {
  const userAgent = req.headers['user-agent'];
  return {
    ip: req.ip,
    ...(userAgent ? { userAgent } : {}),
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}

export const authController = {
  login: (async (req: Request, res: Response) => {
    const input = parseOrThrow(loginSchema, req.body);
    const result = await authService.login(input, requestContext(req));
    setRefreshCookie(res, result.refreshToken);
    return sendOk(res, {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  }) satisfies RequestHandler,

  refresh: (async (req: Request, res: Response) => {
    const token = req.cookies[REFRESH_COOKIE] as string | undefined;
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken);
    return sendOk(res, {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  }) satisfies RequestHandler,

  logout: (async (req: Request, res: Response) => {
    const token = req.cookies[REFRESH_COOKIE] as string | undefined;
    await authService.logout(token);
    clearRefreshCookie(res);
    return sendOk(res, { message: 'Sesión cerrada' });
  }) satisfies RequestHandler,

  me: ((req: Request, res: Response) => {
    return sendOk(res, authService.me(requireAuth(req)));
  }) satisfies RequestHandler,

  changePassword: (async (req: Request, res: Response) => {
    const auth = requireAuth(req);
    const input = parseOrThrow(changePasswordSchema, req.body);
    await authService.changePassword(auth, input);
    return sendOk(res, { message: 'Contraseña actualizada' });
  }) satisfies RequestHandler,

  requestPasswordReset: (async (req: Request, res: Response) => {
    const input = parseOrThrow(requestPasswordResetSchema, req.body);
    const result = await authService.requestPasswordReset(input.email);
    return sendOk(res, {
      message: 'Si el correo existe, se ha enviado un enlace de restablecimiento',
      ...result,
    });
  }) satisfies RequestHandler,

  resetPassword: (async (req: Request, res: Response) => {
    const input = parseOrThrow(resetPasswordSchema, req.body);
    await authService.resetPassword(input);
    return sendOk(res, { message: 'Contraseña restablecida' });
  }) satisfies RequestHandler,
};

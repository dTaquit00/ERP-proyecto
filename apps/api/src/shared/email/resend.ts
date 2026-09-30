import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { InternalError } from '../http/errors.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export async function sendPasswordResetEmail(to: string, firstName: string, token: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.error('Falta RESEND_API_KEY; no se puede enviar el correo de restablecimiento');
    throw new InternalError('No se pudo enviar el correo de restablecimiento');
  }

  const resetUrl = new URL('/reset-password', env.WEB_APP_URL);
  resetUrl.searchParams.set('token', token);
  const safeName = escapeHtml(firstName || '');
  const safeUrl = escapeHtml(resetUrl.toString());
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [to],
      subject: 'Restablece tu contraseña de DATA ERP',
      html: `<p>Hola${safeName ? ` ${safeName}` : ''},</p><p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de DATA ERP.</p><p><a href="${safeUrl}">Crear una nueva contraseña</a></p><p>El enlace vence en 30 minutos y solo se puede usar una vez. Si no solicitaste este cambio, ignora este correo.</p>`,
      text: `Hola${firstName ? ` ${firstName}` : ''},\n\nRestablece tu contraseña de DATA ERP en este enlace (vence en 30 minutos):\n${resetUrl}\n\nSi no solicitaste este cambio, ignora este correo.`,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    logger.error({ status: response.status, details: details.slice(0, 500) }, 'Resend rechazó el correo de restablecimiento');
    throw new InternalError('No se pudo enviar el correo de restablecimiento');
  }
}

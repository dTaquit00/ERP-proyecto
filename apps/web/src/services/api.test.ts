import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest, downloadReport, setAccessToken, setAuthenticationExpiredHandler,
} from './api';

const fetchMock = vi.fn<typeof fetch>();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken('test-token');
});
afterEach(() => {
  fetchMock.mockReset();
  setAccessToken(null);
  setAuthenticationExpiredHandler(null);
  vi.unstubAllGlobals();
});

describe('recuperación de solicitudes API', () => {
  it('conserva la sesión cuando el alojamiento bloquea temporalmente su renovación', async () => {
    const expired = vi.fn();
    setAuthenticationExpiredHandler(expired);
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'Expirado' } }, 401))
      .mockResolvedValueOnce(new Response('Too Many Requests', {
        status: 429, headers: { 'x-render-routing': 'hibernate-rate-limited' },
      }));
    await expect(apiRequest('/products')).rejects.toMatchObject({
      status: 429, message: expect.stringContaining('proveedor de alojamiento'),
    });
    expect(expired).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(json({ data: [] }));
    await apiRequest('/products');
    const headers = fetchMock.mock.calls[2]![1]!.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('notifica la expiración cuando la sesión ya no es válida', async () => {
    const expired = vi.fn();
    setAuthenticationExpiredHandler(expired);
    fetchMock.mockResolvedValueOnce(json({ error: { message: 'Expirado' } }, 401))
      .mockResolvedValueOnce(json({ error: { message: 'Sesión inválida' } }, 401));
    await expect(apiRequest('/products')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('renueva una sola vez para varias consultas simultáneas', async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshes += 1;
        return json({ data: { accessToken: 'renewed-token' } });
      }
      const headers = init?.headers as Headers;
      return headers.get('Authorization') === 'Bearer renewed-token'
        ? json({ data: ['ok'] }) : json({ error: { message: 'Expirado' } }, 401);
    });
    expect(await Promise.all([apiRequest('/products'), apiRequest('/customers')]))
      .toEqual([['ok'], ['ok']]);
    expect(refreshes).toBe(1);
  });

  it.each(['<html>Error del proveedor</html>', '{}', 'null'])(
    'rechaza respuestas incompletas que producirían errores al abrir una pantalla (%s)',
    async (body) => {
      fetchMock.mockResolvedValueOnce(new Response(body));
      await expect(apiRequest('/products')).rejects.toThrow('respuesta inesperada');
    },
  );

  it('muestra el motivo de validación del formulario', async () => {
    fetchMock.mockResolvedValueOnce(json({
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ message: 'Usa entre 7 y 15 dígitos' }] },
    }, 400));
    await expect(apiRequest('/gym/members', { method: 'POST' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', message: expect.stringContaining('Usa entre 7 y 15 dígitos'),
    });
  });

  it('explica un bloqueo del proveedor al descargar un reporte', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Challenge</html>', {
      status: 429, headers: { 'cf-mitigated': 'challenge' },
    }));
    await expect(downloadReport('/reports/sales/export')).rejects.toMatchObject({
      status: 429, message: expect.stringContaining('proveedor de alojamiento'),
    });
  });

  it('explica un fallo de red sin reintentar una escritura', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/sales', { method: 'POST' })).rejects.toThrow('No pudimos conectar');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

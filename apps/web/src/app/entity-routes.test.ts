import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './Root.js';
import type * as AuthProviderModule from '../auth/AuthProvider.js';

vi.mock('../auth/AuthProvider.js', async (importOriginal) => ({
  ...await importOriginal<typeof AuthProviderModule>(),
  useAuth: () => ({
    user: { id: 'admin', firstName: 'Admin', lastName: 'Prueba', email: 'admin@test.local', permissions: [] },
    loading: false,
    can: () => true,
    logout: vi.fn(),
  }),
}));

describe('rutas de formularios de los módulos administrativos y contactos', () => {
  const resources = [
    ['customers', 'cliente'], ['suppliers', 'proveedor'], ['warehouses', 'almacén'],
    ['branches', 'sucursal'], ['companies', 'empresa'], ['users', 'usuario'], ['roles', 'rol'],
  ];

  it.each(resources)('/%s/new abre el alta del recurso correcto (%s)', (resource, label) => {
    const html = renderToStaticMarkup(createElement(MemoryRouter,
      { initialEntries: [`/${resource}/new`] }, createElement(AppRoutes)));
    expect(html).toContain(resource === 'companies' ? 'Nueva empresa' : `Nuevo ${label}`);
    expect(html).toContain('<form');
    expect(html).not.toContain('Módulo no disponible');
  });

  it.each(resources)('/%s/:id carga el detalle del recurso correcto (%s)', (resource, label) => {
    const html = renderToStaticMarkup(createElement(MemoryRouter,
      { initialEntries: [`/${resource}/0123456789abcdef01234567`] }, createElement(AppRoutes)));
    expect(html).toContain(`Cargando ${label}`);
    expect(html).not.toContain('Módulo no disponible');
  });
});

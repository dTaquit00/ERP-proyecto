import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './Root.js';
import { availableReports, canAccessPath } from './access.js';

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('../auth/AuthProvider.js', () => ({
  AuthProvider: () => null,
  useAuth: () => ({
    user: { id: 'user', firstName: 'Persona', lastName: 'Prueba', email: 'user@test.local', permissions: session.permissions },
    loading: false, can: (permission: string) => session.permissions.includes(permission), logout: vi.fn(),
  }),
  useResource: () => ({ loading: false, error: null, data: { ventasHoy: 99, comprasMes: 88, inventarioValorizado: 77, items: [], meta: {} } }),
}));

const can = (permission: string) => session.permissions.includes(permission);
function render(path: string) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes)));
}
beforeEach(() => { session.permissions = []; });

describe('pantallas y menú según permisos', () => {
  it('vendedor ve ventas e inventario pero no compras ni administración', () => {
    session.permissions = ['dashboard.read', 'sales.read', 'sales.write', 'inventory.read', 'products.read', 'customers.read', 'warehouses.read', 'reports.read'];
    const html = render('/dashboard');
    expect(html).toContain('Ventas hoy');
    expect(html).toContain('Movimientos recientes');
    expect(html).not.toContain('Compras mes');
    expect(html).not.toContain('Compras recientes');
    expect(html).not.toContain('Inventario valorizado');
    expect(html).not.toContain('href="/users"');
    expect(html).not.toContain('href="/purchases"');
    expect(html).not.toContain('href="/audit"');
  });

  it('finanzas no ve inventario ni sus movimientos en el resumen', () => {
    session.permissions = ['dashboard.read', 'sales.read', 'purchases.read', 'reports.read', 'reports.export'];
    const html = render('/dashboard');
    expect(html).toContain('Ventas hoy');
    expect(html).toContain('Compras mes');
    expect(html).not.toContain('Movimientos recientes');
    expect(html).not.toContain('Stock bajo');
    expect(html).not.toContain('Inventario valorizado');
  });

  it.each(['/users', '/users/new', '/roles', '/audit', '/purchases', '/purchases/new', '/purchases/123/receive', '/companies/123'])('bloquea la URL directa %s', (path) => {
    session.permissions = ['sales.read', 'dashboard.read'];
    const html = render(path);
    expect(html).toContain('Acceso restringido');
    expect(html).not.toContain('<form');
  });

  it('auditor consulta clientes pero no puede crearlos ni editarlos', () => {
    session.permissions = ['customers.read'];
    expect(canAccessPath('/customers', can)).toBe(true);
    expect(canAccessPath('/customers/123', can)).toBe(true);
    expect(render('/customers/new')).toContain('Acceso restringido');
    const html = render('/customers');
    expect(html).not.toContain('href="/customers/new"');
  });

  it('un rol combinado conserva la suma de los accesos', () => {
    session.permissions = ['sales.read', 'sales.write', 'inventory.read', 'inventory.write', 'products.read', 'customers.read', 'warehouses.read'];
    expect(canAccessPath('/sales/new', can)).toBe(true);
    expect(canAccessPath('/inventory/movements/new', can)).toBe(true);
    expect(canAccessPath('/users', can)).toBe(false);
  });

  it('exige los permisos de consulta necesarios para crear una operación', () => {
    session.permissions = ['sales.write'];
    expect(render('/sales/new')).toContain('Acceso restringido');
  });
});

describe('reportes según permisos del módulo', () => {
  it('compras selecciona por defecto un reporte permitido y no ofrece ventas', () => {
    session.permissions = ['purchases.read', 'inventory.read', 'reports.read'];
    const html = render('/reports');
    expect(html).toContain('value="purchases" selected=""');
    expect(html).not.toContain('value="sales"');
    expect(html).not.toContain('Descargar CSV');
    expect(availableReports(can).map((report) => report.type)).toEqual(['purchases', 'inventory', 'inventory-movements']);
  });

  it('reportes sin permisos de módulos no muestra menús ni pantallas de reportes', () => {
    session.permissions = ['reports.read', 'reports.export'];
    expect(availableReports(can)).toEqual([]);
    expect(render('/reports')).toContain('Acceso restringido');
    expect(render('/dashboard')).not.toContain('href="/reports"');
  });
});

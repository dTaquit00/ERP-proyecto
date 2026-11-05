import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppRoutes } from './Root.js';

const state = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('../auth/AuthProvider.js', () => ({
  AuthProvider: () => null,
  useAuth: () => ({ user: { id: 'test', firstName: 'Ana', lastName: 'Test', email: 'a@test.local', permissions: state.permissions }, loading: false, can: (permission: string) => state.permissions.includes(permission), logout: vi.fn() }),
  useResource: () => ({ loading: false, error: null, data: { enabled: false, ready: false, companyActive: true, conflictingStore: false, products: 3, published: 1 } }),
}));
function render() { return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/gym/setup'] }, createElement(AppRoutes))); }
beforeEach(() => { state.permissions = []; });
it('guía al administrador para publicar productos y crear socios, planes y personal', () => {
  state.permissions = ['products.read', 'products.write', 'categories.read', 'categories.write', 'companies.write', 'members.read', 'members.write', 'memberships.read', 'memberships.write', 'enrollments.read', 'enrollments.write', 'users.read', 'users.write', 'roles.read'];
  const html = render();
  for (const text of ['Puesta en marcha', 'Habilitar tienda', 'Agregar producto', 'Registrar socio', 'Crear membresía', 'Registrar inscripción', 'Crear usuario del personal']) expect(html).toContain(text);
  expect(html).toContain('1 productos activos marcados');
});
it('no ofrece habilitar la tienda ni crear cuentas si faltan esos permisos', () => {
  state.permissions = ['products.read', 'products.write', 'categories.read'];
  const html = render(); expect(html).not.toContain('>Habilitar tienda<'); expect(html).not.toContain('href="/users/new"'); expect(html).not.toContain('href="/gym/members/new"');
});
it('el socio no puede abrir la puesta en marcha del ERP', () => {
  state.permissions = ['portal.read']; expect(render()).toContain('Acceso restringido');
});

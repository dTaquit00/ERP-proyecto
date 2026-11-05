import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppRoutes } from './Root.js';
import { getLandingPath } from './navigation.js';

const state = vi.hoisted(() => ({ loggedIn: false, permissions: [] as string[], empty: false }));
vi.mock('../auth/AuthProvider.js', () => ({
  AuthProvider: () => null,
  useAuth: () => ({ user: state.loggedIn ? { id: 'socio', firstName: 'Ana', lastName: 'Socio', email: 'ana@test.local', permissions: state.permissions } : null, loading: false, can: (permission: string) => state.permissions.includes(permission), logout: vi.fn() }),
  useResource: (path: string) => ({ loading: false, error: null, data: path.startsWith('/public')
    ? { enabled: true, items: state.empty ? [] : [{ id: 'p1', name: 'Producto de prueba', description: 'Descripción de prueba', price: 350, category: 'Suplementos', unit: 'pza', image: null }], meta: { total: 1, totalPages: 1 } }
    : { member: { memberNumber: 'OMH-1', name: 'Ana Socio', isActive: true }, currentMembership: { planName: 'Plan prueba', startDate: '2026-11-01', endDate: '2026-11-30', remainingDays: 12 }, nextMembership: null, enrollments: [] } }),
}));
function render(path: string) { return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes))); }
beforeEach(() => { state.loggedIn = false; state.permissions = []; state.empty = false; });

it.each(['/', '/tienda'])('la tienda %s es pública y permite explorar productos sin iniciar sesión', (path) => {
  const html = render(path);
  expect(html).toContain('Tu esfuerzo.'); expect(html).toContain('Producto de prueba'); expect(html).toContain('href="/login"');
  expect(html).not.toContain('Acceso restringido'); expect(html).not.toContain('href="/users"');
});
it('un catálogo vacío muestra un estado real en lugar de productos inventados', () => {
  state.empty = true;
  const html = render('/tienda'); expect(html).toContain('Estamos preparando nuestro catálogo'); expect(html).not.toContain('Producto de prueba');
});
it('el socio entra a su panel de membresía y no al menú de administración', () => {
  state.loggedIn = true; state.permissions = ['portal.read'];
  const html = render('/mi-cuenta');
  expect(getLandingPath(state.permissions, '')).toBe('/mi-cuenta');
  expect(html).toContain('Ana Socio'); expect(html).toContain('Plan prueba'); expect(html).toContain('12'); expect(html).toContain('días restantes');
  expect(html).not.toContain('Navegación principal'); expect(html).not.toContain('href="/users"'); expect(html).not.toContain('href="/gym/members"');
});
it.each(['/users', '/products', '/gym/members', '/reports', '/dashboard'])('el socio no puede entrar por URL a %s', (path) => {
  state.loggedIn = true; state.permissions = ['portal.read'];
  const html = render(path); expect(html).toContain('Acceso restringido'); expect(html).not.toContain('<form');
});
it('el administrador conserva su página de inicio administrativa aunque pueda consultar el portal', () => {
  expect(getLandingPath(['portal.read', 'dashboard.read', 'users.read'], '')).toBe('/dashboard');
});

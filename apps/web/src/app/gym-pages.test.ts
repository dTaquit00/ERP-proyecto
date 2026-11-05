import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppRoutes } from './Root.js';
import { canAccessPath } from './access.js';
import { getLandingPath } from './navigation.js';

const state = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('../auth/AuthProvider.js', () => ({
  AuthProvider: () => null,
  useAuth: () => ({ user: { id: 'user', firstName: 'Admin', lastName: 'Gym', email: 'admin@gym.test', permissions: state.permissions }, loading: false, can: (permission: string) => state.permissions.includes(permission), logout: vi.fn() }),
  useResource: () => ({ loading: false, error: null, data: { items: [], meta: { total: 0, totalPages: 1 } } }),
}));
function render(path: string) { return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AppRoutes))); }
beforeEach(() => { state.permissions = []; });

it.each(['/gym/members', '/gym/members/new', '/gym/plans', '/gym/plans/new', '/gym/enrollments', '/gym/enrollments/new'])('protege el módulo %s para cuentas sin permiso', (path) => {
  const html = render(path); expect(html).toContain('Acceso restringido'); expect(html).not.toContain('<form');
});
it('muestra el alta de socios y acceso a inscripciones con permisos independientes', () => {
  state.permissions = ['members.read', 'members.write'];
  const html = render('/gym/members/new');
  expect(html).toContain('Número de socio'); expect(html).toContain('Nombre(s)'); expect(html).toContain('Guardar cambios');
  expect(html).not.toContain('href="/gym/enrollments"'); expect(html).not.toContain('href="/users"');
});
it('permite consulta de membresías y oculta la creación para usuarios de solo lectura', () => {
  state.permissions = ['memberships.read'];
  const html = render('/gym/plans'); expect(html).toContain('Membresías'); expect(html).not.toContain('href="/gym/plans/new"');
  expect(render('/gym/plans/new')).toContain('Acceso restringido');
});
it('una inscripción necesita permisos de consulta de socios y membresías', () => {
  state.permissions = ['enrollments.write'];
  expect(canAccessPath('/gym/enrollments/new', (permission) => state.permissions.includes(permission))).toBe(false);
  state.permissions.push('members.read', 'memberships.read');
  expect(canAccessPath('/gym/enrollments/new', (permission) => state.permissions.includes(permission))).toBe(true);
});
it('encuentra una página inicial para el personal con solo permisos de Gym OMH', () => {
  expect(getLandingPath(['members.read'], '')).toBe('/gym/members');
  expect(getLandingPath(['memberships.write'], '')).toBe('/gym/plans/new');
});

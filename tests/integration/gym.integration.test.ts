import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestContext, teardownTestContext, TEST_PASSWORD, type TestContext } from '../helpers/integration.js';
import { GymMemberModel, MembershipPlanModel, EnrollmentModel } from '../../apps/api/src/modules/gym/gym.model.js';
import { CustomerModel } from '../../apps/api/src/modules/customers/customers.model.js';
import { RoleModel } from '../../apps/api/src/modules/roles/roles.model.js';
import { gymToday } from '../../apps/api/src/modules/gym/gym.repository.js';
import { rolesService } from '../../apps/api/src/modules/roles/roles.service.js';

let ctx: TestContext; let admin: string; let limited: string; let other: string;
async function login(email: string) { const response = await request(ctx.app).post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD }); expect(response.status).toBe(200); return response.body.data.accessToken as string; }
async function member(code: string, token = admin) {
  const response = await request(ctx.app).post('/api/v1/gym/members').auth(token, { type: 'bearer' }).send({ memberNumber: code, firstName: 'Ana', lastName: 'López', email: 'ana@gym.test', phone: '2461234567' });
  expect(response.status).toBe(201); return response.body.data as { id: string; customerId: string };
}
async function plan(name: string, token = admin) {
  const response = await request(ctx.app).post('/api/v1/gym/plans').auth(token, { type: 'bearer' }).send({ name, durationDays: 30, price: 350 });
  expect(response.status).toBe(201); return response.body.data as { id: string };
}
beforeAll(async () => {
  ctx = await setupTestContext(); await Promise.all([GymMemberModel.init(), MembershipPlanModel.init(), EnrollmentModel.init()]);
  admin = await login('admin@test.local'); limited = await login('limited@test.local'); other = await login('admin@other.local');
});
afterAll(async () => { if (ctx) await teardownTestContext(ctx); });

describe('Gym OMH: socios, membresías e inscripciones', () => {
  it('protege todos los recursos por permiso de lectura y escritura', async () => {
    for (const resource of ['members', 'plans', 'enrollments']) {
      expect((await request(ctx.app).get(`/api/v1/gym/${resource}`)).status).toBe(401);
      expect((await request(ctx.app).get(`/api/v1/gym/${resource}`).auth(limited, { type: 'bearer' })).status).toBe(403);
      expect((await request(ctx.app).post(`/api/v1/gym/${resource}`).auth(limited, { type: 'bearer' }).send({})).status).toBe(403);
    }
  });
  it('crea un socio vinculado a Clientes y conserva los contactos al editar parcialmente', async () => {
    const created = await member('OMH-001');
    const customer = await CustomerModel.findById(created.customerId);
    expect(customer?.name).toBe('Ana López');
    const response = await request(ctx.app).patch(`/api/v1/gym/members/${created.id}`).auth(admin, { type: 'bearer' }).send({ firstName: 'Eva', isActive: false });
    expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ firstName: 'Eva', email: 'ana@gym.test', isActive: false });
    expect((await CustomerModel.findById(created.customerId))?.name).toBe('Eva López');
    await request(ctx.app).patch(`/api/v1/gym/members/${created.id}`).auth(admin, { type: 'bearer' }).send({ notes: 'Contacto actualizado' });
    expect((await GymMemberModel.findById(created.id))?.isActive).toBe(false);
  });
  it('evita números duplicados y revierte la creación del cliente si falla el socio', async () => {
    await member('OMH-DUP'); const before = await CustomerModel.countDocuments({ companyId: ctx.company.id });
    const duplicate = await request(ctx.app).post('/api/v1/gym/members').auth(admin, { type: 'bearer' }).send({ memberNumber: 'OMH-DUP', firstName: 'Otra', lastName: 'Persona' });
    expect(duplicate.status).toBe(409);
    expect(await CustomerModel.countDocuments({ companyId: ctx.company.id })).toBe(before);
  });
  it('filtra socios por búsqueda y estado sin ampliar el alcance multiempresa', async () => {
    const response = await request(ctx.app).get('/api/v1/gym/members?search=OMH-001&status=inactive').auth(admin, { type: 'bearer' });
    expect(response.status).toBe(200); expect(response.body.data.items).toHaveLength(1);
    expect((await request(ctx.app).get('/api/v1/gym/members?search=OMH-001').auth(other, { type: 'bearer' })).body.data.items).toEqual([]);
    expect((await request(ctx.app).get('/api/v1/gym/members?search=%5B').auth(admin, { type: 'bearer' })).status).toBe(200);
  });
  it('impide leer y editar socios o planes de otra empresa', async () => {
    const created = await member('OMH-SCOPE'); const createdPlan = await plan('Plan aislado');
    for (const [resource, id] of [['members', created.id], ['plans', createdPlan.id]]) {
      expect((await request(ctx.app).get(`/api/v1/gym/${resource}/${id}`).auth(other, { type: 'bearer' })).status).toBe(404);
      expect((await request(ctx.app).patch(`/api/v1/gym/${resource}/${id}`).auth(other, { type: 'bearer' }).send({ isActive: false })).status).toBe(404);
    }
  });
  it('calcula vigencia y precio desde el plan, conserva históricos y rechaza periodos solapados', async () => {
    const created = await member('OMH-ENROLL'); const createdPlan = await plan('Mensual histórico');
    const input = { memberId: created.id, planId: createdPlan.id, startDate: '2026-01-31', amountPaid: 200, price: 0, endDate: '2030-01-01' };
    const enrollment = await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send(input);
    expect(enrollment.status).toBe(201); expect(enrollment.body.data).toMatchObject({ endDate: '2026-03-01', price: 350, amountPaid: 200, balance: 150 });
    expect((await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send(input)).status).toBe(409);
    await request(ctx.app).patch(`/api/v1/gym/plans/${createdPlan.id}`).auth(admin, { type: 'bearer' }).send({ price: 500, durationDays: 15 });
    const detail = await request(ctx.app).get(`/api/v1/gym/enrollments/${enrollment.body.data.id}`).auth(admin, { type: 'bearer' });
    expect(detail.body.data).toMatchObject({ price: 350, durationDays: 30, endDate: '2026-03-01' });
    expect((await request(ctx.app).get(`/api/v1/gym/enrollments/${enrollment.body.data.id}`).auth(other, { type: 'bearer' })).status).toBe(404);
    expect((await request(ctx.app).post(`/api/v1/gym/enrollments/${enrollment.body.data.id}/cancel`).auth(other, { type: 'bearer' })).status).toBe(404);
  });
  it('dos inscripciones simultáneas no duplican una membresía para el mismo periodo', async () => {
    const created = await member('OMH-RACE'); const createdPlan = await plan('Plan concurrente');
    const responses = await Promise.all([1, 2].map(() => request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send({ memberId: created.id, planId: createdPlan.id, startDate: '2027-01-01' })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await EnrollmentModel.countDocuments({ memberId: created.id })).toBe(1);
  });
  it('bloquea referencias ajenas, inactivas y pagos superiores al precio', async () => {
    const created = await member('OMH-REF'); const createdPlan = await plan('Plan validación'); const foreign = await plan('Plan ajeno', other);
    for (const [extra, expected] of [[{ planId: foreign.id }, 404], [{ amountPaid: 351 }, 400]] as const) {
      const response = await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send(Object.assign({ memberId: created.id, planId: createdPlan.id, startDate: '2027-03-01' }, extra));
      expect(response.status).toBe(expected);
    }
    await request(ctx.app).patch(`/api/v1/gym/plans/${createdPlan.id}`).auth(admin, { type: 'bearer' }).send({ isActive: false });
    expect((await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send({ memberId: created.id, planId: createdPlan.id, startDate: '2027-03-01' })).status).toBe(400);
    expect(await EnrollmentModel.countDocuments({ memberId: created.id })).toBe(0);
  });
  it('permite cancelar y volver a inscribir, conservando el historial y el pago registrado', async () => {
    const created = await member('OMH-CANCEL'); const createdPlan = await plan('Plan cancelación');
    const input = { memberId: created.id, planId: createdPlan.id, startDate: gymToday() };
    const first = await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send(input);
    expect(first.status).toBe(201); expect(first.body.data.status).toBe('active');
    const cancel = await request(ctx.app).post(`/api/v1/gym/enrollments/${first.body.data.id}/cancel`).auth(admin, { type: 'bearer' });
    expect(cancel.status).toBe(200); expect(cancel.body.data).toMatchObject({ status: 'cancelled', amountPaid: 350 });
    expect((await request(ctx.app).post('/api/v1/gym/enrollments').auth(admin, { type: 'bearer' }).send(input)).status).toBe(201);
    const cancelled = await request(ctx.app).get(`/api/v1/gym/enrollments?memberId=${created.id}&status=cancelled`).auth(admin, { type: 'bearer' });
    expect(cancelled.body.data.items).toHaveLength(1);
  });
  it('la migración de permisos es aditiva, idempotente y exclusiva del administrador del sistema', async () => {
    await RoleModel.updateOne({ _id: ctx.adminRole.id }, { $pull: { permissions: 'members.write' } });
    await rolesService.ensureGymAdminPermissions(); await rolesService.ensureGymAdminPermissions();
    const adminRole = await RoleModel.findById(ctx.adminRole.id); const limitedRole = await RoleModel.findById(ctx.limitedRole.id);
    expect(adminRole?.permissions.filter((permission) => permission === 'members.write')).toHaveLength(1);
    expect(limitedRole?.permissions).not.toContain('members.read');
  });
});

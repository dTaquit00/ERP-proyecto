import type { Request, Response, RequestHandler } from 'express';
import { createGymMemberSchema, updateGymMemberSchema, createMembershipPlanSchema, updateMembershipPlanSchema, createEnrollmentSchema, gymListSchema, enrollmentListSchema, idParamsSchema } from '@erp/validation';
import { requireAuth } from '../../shared/http/auth-req.js';
import { parseOrThrow } from '../../shared/http/parse.js';
import { sendOk, sendCreated, sendPaginated } from '../../shared/http/response.js';
import { gymService } from './gym.service.js';

const handle = (action: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req, res) => { await action(req, res); };
const company = (req: Request) => requireAuth(req).user.companyId;
const id = (req: Request) => parseOrThrow(idParamsSchema, req.params).id;
export const gymController = {
  listMembers: handle(async (req, res) => { const result = await gymService.listMembers(company(req), parseOrThrow(gymListSchema, req.query)); return sendPaginated(res, result.items, result.meta); }),
  getMember: handle(async (req, res) => sendOk(res, await gymService.getMember(company(req), id(req)))),
  createMember: handle(async (req, res) => sendCreated(res, await gymService.createMember(company(req), parseOrThrow(createGymMemberSchema, req.body)))),
  updateMember: handle(async (req, res) => sendOk(res, await gymService.updateMember(company(req), id(req), parseOrThrow(updateGymMemberSchema, req.body)))),
  listPlans: handle(async (req, res) => { const result = await gymService.listPlans(company(req), parseOrThrow(gymListSchema, req.query)); return sendPaginated(res, result.items, result.meta); }),
  getPlan: handle(async (req, res) => sendOk(res, await gymService.getPlan(company(req), id(req)))),
  createPlan: handle(async (req, res) => sendCreated(res, await gymService.createPlan(company(req), parseOrThrow(createMembershipPlanSchema, req.body)))),
  updatePlan: handle(async (req, res) => sendOk(res, await gymService.updatePlan(company(req), id(req), parseOrThrow(updateMembershipPlanSchema, req.body)))),
  listEnrollments: handle(async (req, res) => { const result = await gymService.listEnrollments(company(req), parseOrThrow(enrollmentListSchema, req.query)); return sendPaginated(res, result.items, result.meta); }),
  getEnrollment: handle(async (req, res) => sendOk(res, await gymService.getEnrollment(company(req), id(req)))),
  createEnrollment: handle(async (req, res) => sendCreated(res, await gymService.createEnrollment(company(req), parseOrThrow(createEnrollmentSchema, req.body), requireAuth(req).user.id))),
  cancelEnrollment: handle(async (req, res) => sendOk(res, await gymService.cancelEnrollment(company(req), id(req)))),
};

import type { Response } from 'express';
import type { ApiSuccess, Paginated, PaginationMeta } from '@erp/types';

/** 200 con cuerpo `{ data }`. */
export function sendOk<T>(res: Response, data: T): Response {
  return res.status(200).json({ data } satisfies ApiSuccess<T>);
}

/** 201 con cuerpo `{ data }`. */
export function sendCreated<T>(res: Response, data: T): Response {
  return res.status(201).json({ data } satisfies ApiSuccess<T>);
}

/** 200 con listado paginado `{ data: { items, meta } }`. */
export function sendPaginated<T>(res: Response, items: T[], meta: PaginationMeta): Response {
  return res.status(200).json({ data: { items, meta } satisfies Paginated<T> });
}

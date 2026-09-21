/** Respuesta exitosa estándar de la API. */
export interface ApiSuccess<T> {
  data: T;
}

/** Detalle de un campo inválido (validación de entrada). */
export interface ErrorDetail {
  path: string;
  message: string;
  code?: string;
}

/** Respuesta de error estándar de la API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    /** Solo se incluye fuera de producción para errores 5xx. */
    stack?: string;
  };
}

/** Parámetros de paginación aceptados por la API. */
export interface PaginationQuery {
  page: number;
  limit: number;
}

/** Metadatos de una página de resultados. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Envoltorio de listados paginados. */
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export type SortOrder = 'asc' | 'desc';

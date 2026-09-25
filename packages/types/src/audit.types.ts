export type AuditResult = 'success' | 'failure';
export interface AuditLogResponse {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  result: AuditResult;
  metadata: Record<string, unknown>;
  createdAt: string;
}

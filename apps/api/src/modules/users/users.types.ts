/** Entrada del historial de un usuario (M02). */
export interface UserSessionHistoryEntry {
  id: string;
  ip: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

export interface UserHistoryResponse {
  userId: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  sessions: UserSessionHistoryEntry[];
}

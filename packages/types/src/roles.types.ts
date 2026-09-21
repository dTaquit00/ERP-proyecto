import type { Permission } from './permissions.js';

/** Vista de un rol con el número de usuarios asignados (M03). */
export interface RoleResponse {
  id: string;
  name: string;
  displayName: string;
  permissions: Permission[];
  isSystem: boolean;
  userCount: number;
}

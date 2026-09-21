import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { rolesRoutes } from '../modules/roles/roles.routes.js';
import { permissionsRoutes } from '../modules/permissions/permissions.routes.js';
import { categoriesRoutes } from '../modules/categories/categories.routes.js';
import { productsRoutes } from '../modules/products/products.routes.js';

/** Router maestro bajo /api/v1 — aquí se montarán los módulos por fase. */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/roles', rolesRoutes);
apiRouter.use('/permissions', permissionsRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/products', productsRoutes);

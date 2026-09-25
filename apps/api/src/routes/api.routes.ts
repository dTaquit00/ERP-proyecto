import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { usersRoutes } from '../modules/users/users.routes.js';
import { rolesRoutes } from '../modules/roles/roles.routes.js';
import { permissionsRoutes } from '../modules/permissions/permissions.routes.js';
import { categoriesRoutes } from '../modules/categories/categories.routes.js';
import { productsRoutes } from '../modules/products/products.routes.js';
import { warehousesRoutes } from '../modules/warehouses/warehouses.routes.js';
import { inventoryRoutes } from '../modules/inventory/inventory.routes.js';
import { customersRoutes } from '../modules/customers/customers.routes.js';
import { suppliersRoutes } from '../modules/suppliers/suppliers.routes.js';
import { salesRoutes } from '../modules/sales/sales.routes.js';
import { companiesRoutes } from '../modules/companies/companies.routes.js';
import { branchesRoutes } from '../modules/branches/branches.routes.js';
import { purchasesRoutes } from '../modules/purchases/purchases.routes.js';
import { auditRoutes } from '../modules/audit/audit.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { reportsRoutes } from '../modules/reports/reports.routes.js';

/** Router maestro bajo /api/v1 — aquí se montarán los módulos por fase. */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/roles', rolesRoutes);
apiRouter.use('/permissions', permissionsRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/products', productsRoutes);
apiRouter.use('/warehouses', warehousesRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/customers', customersRoutes);
apiRouter.use('/suppliers', suppliersRoutes);
apiRouter.use('/sales', salesRoutes);
apiRouter.use('/companies', companiesRoutes);
apiRouter.use('/branches', branchesRoutes);
apiRouter.use('/purchases', purchasesRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/reports', reportsRoutes);

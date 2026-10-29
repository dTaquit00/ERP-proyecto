import { expect, test, type Page } from '@playwright/test';

const password = 'E2e-Only-Passw0rd!';

async function signIn(page: Page, role: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(`${role}@e2e.local`);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen operativo' })).toBeVisible();
}

test('E2E-001 muestra el login DATA ERP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tu operación, en foco.' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'DATA ERP' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('E2E-002 valida campos obligatorios de login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByLabel('Correo')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Contraseña')).toHaveAttribute('required', '');
});

test('E2E-005 protege rutas privadas y no muestra login a una sesión activa', async ({ page }) => {
  await page.goto('/customers/new');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Tu operación, en foco.' })).toBeVisible();

  await signIn(page, 'administrador');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Resumen operativo' })).toBeVisible();
});

test('E2E-006 crea y consulta clientes con validación de teléfono y código postal', async ({ page }) => {
  await signIn(page, 'administrador');
  await page.goto('/customers/new');
  await expect(page.getByRole('heading', { name: 'Nuevo cliente' })).toBeVisible();

  const phone = page.getByLabel('Teléfono');
  const postalCode = page.getByLabel('Código postal');
  await phone.fill('abc');
  expect(await phone.evaluate((element) => (element as unknown as { matches(selector: string): boolean }).matches(':invalid'))).toBe(true);
  await postalCode.fill('12A');
  expect(await postalCode.evaluate((element) => (element as unknown as { matches(selector: string): boolean }).matches(':invalid'))).toBe(true);

  await page.getByLabel('Nombre').fill('Cliente E2E formulario completo');
  await phone.fill('+52 (55) 1234-5678');
  await postalCode.fill('01234');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/customers$/);

  const customerLink = page.getByRole('link', { name: 'Cliente E2E formulario completo' });
  await expect(customerLink).toBeVisible();
  await customerLink.click();
  await expect(page.getByRole('heading', { name: 'Editar cliente' })).toBeVisible();
  await expect(page.getByLabel('Teléfono')).toHaveValue('+52 (55) 1234-5678');
  await expect(page.getByLabel('Código postal')).toHaveValue('01234');
});

test('E2E-007 abre los siete formularios de alta con su recurso correcto', async ({ page }) => {
  await signIn(page, 'administrador');
  for (const [resource, title] of [
    ['customers', 'Nuevo cliente'], ['suppliers', 'Nuevo proveedor'],
    ['warehouses', 'Nuevo almacén'], ['branches', 'Nuevo sucursal'],
    ['companies', 'Nueva empresa'], ['users', 'Nuevo usuario'], ['roles', 'Nuevo rol'],
  ]) {
    await page.goto(`/${resource}/new`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('Módulo no disponible', { exact: true })).toHaveCount(0);
  }
});

test('E2E-008 crea usuario, cambia su rol y verifica sus permisos al iniciar sesión', async ({ page }) => {
  await signIn(page, 'administrador');
  await page.goto('/users');
  await page.getByRole('link', { name: 'Nuevo usuario', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Operador');
  await page.getByLabel('Apellido', { exact: true }).fill('Prueba');
  await page.getByLabel('Correo', { exact: true }).fill('operador@e2e.local');
  await page.getByLabel('Rol', { exact: true }).selectOption({ label: 'Vendedor' });
  await page.getByLabel('Contraseña inicial (mínimo 12 caracteres)').fill(password);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/users$/);
  const row = page.getByRole('row').filter({ hasText: 'operador@e2e.local' });
  await expect(row).toContainText('vendedor');
  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Editar usuario' })).toBeVisible();
  await page.getByLabel('Rol', { exact: true }).selectOption({ label: 'Compras' });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(row).toContainText('compras');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await signIn(page, 'operador');
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(navigation.getByRole('link', { name: 'Compras', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);
  await page.goto('/users/new');
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
});

test('E2E-009 crea y consulta sucursal, almacén, proveedor y rol; consulta la empresa', async ({ page }) => {
  await signIn(page, 'administrador');
  for (const entry of [
    { resource: 'branches', name: 'Sucursal E2E formulario', field: 'Nombre', extra: ['Código', 'SUC-E2E'] },
    { resource: 'warehouses', name: 'Almacén E2E formulario', field: 'Nombre del almacén' },
    { resource: 'suppliers', name: 'Proveedor E2E formulario', field: 'Razón social / nombre' },
    { resource: 'roles', name: 'Rol E2E formulario', field: 'Nombre visible', extra: ['Clave del rol (minúsculas, guiones o guion bajo)', 'rol-e2e'] },
  ]) {
    await page.goto(`/${entry.resource}/new`);
    await page.getByLabel(entry.field, { exact: true }).fill(entry.name);
    if (entry.extra) await page.getByLabel(entry.extra[0]!, { exact: true }).fill(entry.extra[1]!);
    if (entry.resource === 'roles') await page.getByRole('checkbox', { name: 'dashboard.read', exact: true }).check();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page).toHaveURL(new RegExp(`/${entry.resource}$`));
    // Roles use their stable key as the list label.
    await page.getByRole('link', { name: entry.resource === 'roles' ? 'rol-e2e' : entry.name, exact: true }).click();
    await expect(page.getByLabel(entry.field, { exact: true })).toHaveValue(entry.name);
  }
  await page.goto('/companies');
  await page.getByRole('link', { name: 'DATA ERP Playwright E2E', exact: true }).click();
  await expect(page.getByLabel('Nombre comercial')).toHaveValue('DATA ERP Playwright E2E');
});

test('E2E-003 crea producto, registra stock, confirma una venta y consulta/exporta el reporte', async ({ page }) => {
  await signIn(page, 'administrador');

  await page.goto('/categories/new');
  await page.getByLabel('Nombre').fill('Categoría Playwright E2E');
  await page.getByLabel('Descripción').fill('Categoría temporal de pruebas automatizadas');
  await page.getByRole('button', { name: 'Guardar categoría' }).click();
  await expect(page.getByRole('link', { name: 'Categoría Playwright E2E' })).toBeVisible();

  await page.goto('/products/new');
  await page.getByLabel('Nombre').fill('Producto Playwright E2E');
  await page.getByLabel('SKU').fill('SKU-E2E-001');
  await page.getByLabel('Categoría').selectOption({ label: 'Categoría Playwright E2E' });
  await page.getByLabel('Precio de compra').fill('20');
  await page.getByLabel('Precio de venta').fill('50');
  await page.getByLabel('Unidad', { exact: true }).selectOption('pza');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByRole('link', { name: 'Producto Playwright E2E' })).toBeVisible();

  await page.goto('/inventory/movements/new');
  await page.getByLabel('Producto').selectOption({ label: 'Producto Playwright E2E' });
  await page.getByLabel('Almacén').selectOption({ label: 'Almacén Playwright E2E' });
  await page.getByRole('spinbutton').fill('10');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page).toHaveURL(/\/inventory\/movements$/);

  await page.goto('/sales/new');
  await page.getByLabel('Cliente').selectOption({ label: 'Cliente Playwright E2E' });
  await page.getByLabel('Almacén').selectOption({ label: 'Almacén Playwright E2E' });
  const productSelect = page.getByLabel('Producto');
  const productValue = await productSelect.locator('option').filter({ hasText: 'SKU-E2E-001' }).getAttribute('value');
  expect(productValue).toBeTruthy();
  await productSelect.selectOption(productValue!);
  await page.getByLabel('Cantidad').fill('2');
  await page.getByRole('button', { name: 'Crear venta pendiente' }).click();
  await expect(page).toHaveURL(/\/sales$/);

  const saleRow = page.getByRole('row').filter({ hasText: 'Cliente Playwright E2E' });
  await expect(saleRow).toBeVisible();
  await saleRow.getByRole('button', { name: 'Confirmar' }).click();
  await expect(saleRow).toContainText('Confirmada');

  await page.goto('/inventory');
  const stockRow = page.getByRole('row').filter({ hasText: 'Producto Playwright E2E' });
  await expect(stockRow).toContainText('8');

  await page.goto('/reports');
  await page.getByLabel('Reporte').selectOption('sales');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Cliente Playwright E2E' })).toBeVisible();

  await page.getByLabel('Formato').selectOption('csv');
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/\.csv$/i);

  await page.getByLabel('Formato').selectOption('pdf');
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF' }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/i);
});

test('E2E-004 la navegación respeta los permisos de los siete roles', async ({ page }) => {
  const cases = [
    { role: 'administrador', visible: ['Ventas', 'Compras', 'Reportes', 'Auditoría', 'Usuarios'], hidden: [] },
    { role: 'gerente', visible: ['Ventas', 'Compras', 'Reportes'], hidden: ['Auditoría', 'Usuarios'] },
    { role: 'vendedor', visible: ['Ventas', 'Reportes'], hidden: ['Compras', 'Auditoría'] },
    { role: 'almacen', visible: ['Inventario', 'Compras'], hidden: ['Ventas', 'Reportes'] },
    { role: 'compras', visible: ['Compras', 'Reportes'], hidden: ['Ventas', 'Auditoría'] },
    { role: 'finanzas', visible: ['Ventas', 'Compras', 'Reportes'], hidden: ['Inventario', 'Auditoría'] },
    { role: 'auditor', visible: ['Ventas', 'Compras', 'Reportes', 'Auditoría', 'Usuarios'], hidden: [] },
  ];

  for (const item of cases) {
    await signIn(page, item.role);
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    for (const label of item.visible) await expect(navigation.getByRole('link', { name: label, exact: true })).toBeVisible();
    for (const label of item.hidden) await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  }
});

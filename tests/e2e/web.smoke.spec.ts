import { test, expect } from '@playwright/test';

test('E2E-001 muestra login del ERP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('NEXUS ERP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('E2E-002 valida campos obligatorios de login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('input[type="email"]')).toHaveAttribute('required', '');
});

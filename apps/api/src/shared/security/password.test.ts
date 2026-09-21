import { describe, expect, it } from 'vitest';
import { getDummyPasswordHash, hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('genera un hash con formato scrypt y sin texto plano', async () => {
    const hash = await hashPassword('MiClave123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('MiClave123');
    expect(hash.split('$')).toHaveLength(6);
  });

  it('verifica la contraseña correcta', async () => {
    const hash = await hashPassword('MiClave123');
    await expect(verifyPassword('MiClave123', hash)).resolves.toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('MiClave123');
    await expect(verifyPassword('otra-clave', hash)).resolves.toBe(false);
  });

  it('usa un sal aleatorio: el mismo texto plano produce hashes distintos', async () => {
    const [a, b] = await Promise.all([hashPassword('MiClave123'), hashPassword('MiClave123')]);
    expect(a).not.toBe(b);
  });

  it('rechaza hashes malformados sin lanzar excepciones', async () => {
    await expect(verifyPassword('x', 'no-es-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$1$1$1$@@@')).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$123$456$789$abc$def')).resolves.toBe(false);
  });

  it('el hash ficticio (anti-enumeración) es válido pero no corresponde a ninguna cuenta', async () => {
    const dummy = await getDummyPasswordHash();
    expect(dummy.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('cualquiera', dummy)).resolves.toBe(false);
  });
});

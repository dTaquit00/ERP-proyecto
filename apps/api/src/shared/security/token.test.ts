import { describe, expect, it } from 'vitest';
import { generateRandomToken, hashToken } from './token.js';

describe('generateRandomToken', () => {
  it('genera tokens únicos y no vacíos', () => {
    const a = generateRandomToken();
    const b = generateRandomToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('respeta el número de bytes solicitado (base64url ≈ 4/3 del tamaño)', () => {
    const token = generateRandomToken(32);
    expect(token.length).toBeGreaterThanOrEqual(42);
  });
});

describe('hashToken', () => {
  it('produce el mismo hash para el mismo token (SHA-256 hex)', () => {
    const token = 'abc-123';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produce hashes distintos para tokens distintos', () => {
    expect(hashToken('uno')).not.toBe(hashToken('dos'));
  });

  it('no permite recuperar el token original a partir del hash', () => {
    expect(hashToken('secreto')).not.toContain('secreto');
  });
});

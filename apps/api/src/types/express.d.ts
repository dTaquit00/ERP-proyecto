import type { AuthContext } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Contexto de autenticación; lo inicia el middleware `authenticate`. */
      auth?: AuthContext;
    }
  }
}

export {};

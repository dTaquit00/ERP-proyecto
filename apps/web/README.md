# @erp/web — ERP Web (React Native Web)

> Estado: pendiente. Se implementa en la **Fase 16** sobre la API REST existente (`apps/api`).

Stack previsto: React Native Web + TypeScript + la capa `packages/ui`.

Reglas del proyecto:

- Nunca conectarse directamente a MongoDB: todo pasa por `/api/v1`.
- Sin datos falsos: el dashboard y los listados consumen la API real.
- Tablas con paginación; nunca cargar miles de registros de una vez.

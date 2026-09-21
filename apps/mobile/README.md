# @erp/mobile — ERP Móvil (React Native)

> Estado: pendiente. Se implementa en la **Fase 16** sobre la API REST existente (`apps/api`).

Stack previsto: React Native + TypeScript + la capa `packages/ui`.

Kotlin se usará **únicamente** si React Native no puede acceder de forma adecuada a una función nativa
de Android (por ejemplo, integración específica de hardware). No se usará por convención.

Reglas:

- Nunca conectarse directamente a MongoDB.
- Botones, formularios, tablas y menús adaptados a pantalla táctil.
- Sesión con access token corto + refresh cookie httpOnly (manejada por la capa de red compartida).

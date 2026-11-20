# PROJECT_STATUS.md — registro de desarrollo

> Estado a **2026-11-20**. Rama `master`, **sincronizar el número exacto de commits con `git status` antes de push**.
> Este archivo se actualiza al terminar cada tarea importante. Para contexto permanente, ver `AGENTS.md`.

## Resumen

Portal Avera/GCF: SPA Angular 18 + un Cloudflare Worker con D1/R2. Cubre leads, evaluación de perfil, pre-acreditación (Stage 1), acreditación (Stage 2), Readiness y panel de administración. `worker/README.md` es la referencia detallada de rutas, secretos y despliegue.

## Funcionalidades completadas

| Tarea | Commit(es) | Archivos clave |
| --- | --- | --- |
| Reconstrucción del cuestionario Stage 1 según el PDF de referencia (5 pasos, secciones 1.1–3.5) | `f48cab0` | `pages/stage1/*`, `shared/components/stage1-steps/*`, `shared/data/form-steps.config.ts` |
| Logout → `/home` | `69b0cc8` | `services/auth.service.ts` |
| Pestaña Files ordenada por origen (readiness → pre-accreditation → accreditation) y sección; notas de revisión enviadas como snapshot y visibles en el solicitante | `503287d` | `worker/index.ts`, `models/organization.model.ts`, `models/applicant-dashboard.model.ts`, `pages/admin/organizations/admin-organization-edit.*`, `pages/dashboard/applicant/*` |
| Correo de cambio de estado: explica el resultado y que Stage 2 está accesible (requiere `RESEND_API_KEY`) | `503287d` (+ texto actualizado en `588f372`) | `worker/index.ts` (`notifyPreScreeningStatus`) |
| Favoritos en leads: columna con checkbox, guardado y orden (favoritos primero) | `8785d09`, `632895a`, `cb1c220`, `a3f5e3f`, `4fd507a`, `38f5c55` | `models/applicant.model.ts`, `pages/dashboard/leads-import/*`, `worker/schema.sql`, `worker/migrations/2026-11-22_leads_favorite.sql` |
| Renombrado visible "pre-screening" → "pre-accreditation" en UI, correos y 7 idiomas (claves internas intactas) | `588f372` | `src/assets/i18n/*.json`, `pages/stage1/*`, `pages/stage2/*`, `worker/index.ts`, `shared/components/chat/*` |
| Campo `region` eliminado de formularios; `country` integrado en la tarjeta de organización del perfil | `bc9007a` | `pages/profile-assessment/profile-assessment.component.*` |
| CTA "Get assessed" oculto en la landing cuando hay sesión | `029fa28` | `pages/landing/landing.component.html` |
| Aviso al salir del email si ya pertenece a un usuario activo (readiness, pre-acreditación, perfil) | `17f26dd`, `336e495` | `services/user.service.ts` (`findByEmail`), `pages/readiness/*`, `pages/stage1/*`, `shared/components/stage1-steps/*`, `pages/profile-assessment/*`, `src/assets/i18n/*.json` (`USER.EMAIL_EXISTS`) |
| Corrección del checkbox de favoritos en la tabla de leads: columnas `thead`/`tbody` alineadas y estilo propio para el toggle | `495b056` | `pages/dashboard/leads-import/leads-import.component.html`, `.css` |
| Migración `favorite` aplicada a la BD local por defecto y a D1 remota | `e94d19f` (docs) | `worker/migrations/2026-11-22_leads_favorite.sql` |
| Breadcrumb visible siempre arriba a la izquierda y menú público oculto en la vista anónima de Stage 1 | `97361e0` | `layout/layout.component.*`, `shared/components/breadcrumb/*` |
| Leads: reemplazar favoritos por un dropdown de prioridad (`low/medium/high/critical`) y ordenar por prioridad | sin commitear | `models/applicant.model.ts`, `pages/dashboard/leads-import/*`, `worker/index.ts`, `worker/schema.sql`, `worker/migrations/2026-11-20_leads_priority.sql` |

Verificación de la última tarea: `tsc --noEmit`, `worker:typecheck` y `ng build` en verde. Breadcrumb comprobado en navegador en `/stage1` anónimo (visible arriba a la izquierda, sin menú público) y en rutas logueadas con y sin entrada en `ROUTE_MAP`. Prioridad comprobada en navegador: dropdown en la columna "Priority", cambio persistente tras recargar (clase `priority-critical` y `PATCH /api/leads/:id`); migración aplicada en local (por defecto y `gcf-verify`) y en D1 remota, con 6 leads antiguamente favoritos convertidos a `high` y la columna `favorite` eliminada.

## En desarrollo

Ninguna tarea activa. El breadcrumb unificado y el menú anónimo de Stage 1 están cerrados y commiteados (`97361e0`). La sustitución de favoritos por prioridad está implementada y verificada, pendiente de commit; la migración `2026-11-20_leads_priority.sql` ya está aplicada en local (por defecto y `gcf-verify`) y en D1 remota.

## Pendientes

1. **Hacer push** de los commits a `origin/master` (el Worker desplegado sigue sirviendo el código anterior hasta que se redeplogue).
2. Sustituir la comprobación de email duplicado por una consulta al backend (D1 `users`): `UserService.findByEmail()` solo conoce las cuentas semilla del navegador, por lo que no detecta cuentas creadas en producción.
3. Ampliar tests: hay 9 specs (mayoría de servicios); ninguno cubre favoritos, notas de revisión ni el aviso de email.
4. Probar el envío real de correos con `RESEND_API_KEY` (en local no hay clave; el worker omite el envío).
5. Rotar/quitar las cuentas demo con contraseñas conocidas que siembra `worker/schema.sql` (documentado en `worker/README.md`).

## Bugs conocidos

- Ninguno bloqueante. El error `TS18048` en `leads-import.component.ts:656` quedó resuelto en `4fd507a`.
- Resuelto (`495b056`): en la tabla de leads guardados, el checkbox de favorito estaba debajo de la cabecera "Select all" y el checkbox de selección para borrar debajo de "Favorite". Al hacer clic en "Favorite" se seleccionaba la fila para borrar. Ahora `thead` y `tbody` tienen el mismo orden y el favorito usa un estilo propio (`.favorite-check`).
- Resuelto (2026-11-20): marcar favorito devolvía "Could not update the row on the server" porque la columna `favorite` faltaba en la BD local por defecto y en D1 remota. La migración `2026-11-22_leads_favorite.sql` ya está aplicada en local (por defecto y `gcf-verify`) y en remoto. Los favoritos se han eliminado del todo en favor de `priority` (`2026-11-20_leads_priority.sql`).
- Resuelto (`97361e0`): el breadcrumb solo se mostraba con sesión iniciada y en 11 rutas mapeadas; ahora se renderiza siempre en el layout, se ancla a la izquierda también en RTL y usa el contexto de la página o un fallback para rutas sin mapear. El menú público (`public-nav`) ya no aparece en la vista anónima de `/stage1`.
- Sin `RESEND_API_KEY`, `/api/send-review-email`, reset y ambientes devuelven 501 y la UI cae a Gmail compose: es comportamiento previsto, no un fallo.
- `wrangler dev` con `--persist-to %TEMP%\gcf-verify` usa una BD distinta de la local por defecto: las migraciones aplicadas en un persist dir no afectan al otro.

## Problemas técnicos identificados

- El índice Git guarda LF y parte del árbol de trabajo tiene CRLF (`core.autocrlf=false`). Un script que reescriba archivos con `fs.writeFileSync` puede convertir el archivo completo en un diff; revisar con `git diff --ignore-cr-at-eol` antes de commitear.
- `ng build` necesita `$env:NODE_OPTIONS="--max-old-space-size=4096"`; emite avisos de presupuesto CSS (warn 10 kB / error 80 kB por componente).
- En componentes standalone se importa `TranslatePipe` de `@ngx-translate/core` (no `TranslateModule`).
- Los campos nuevos de formularios no necesitan migración: D1 guarda el payload JSON completo. Solo las columnas relacionales nuevas requieren `worker/migrations/*.sql`.
- Las claves i18n con `PRESCREENING` y el tipo `SubmissionForm = 'pre-screening' | ...` son contratos de datos: no renombrarlos aunque el texto visible ya diga Pre-Accreditation.

## Últimos cambios realizados

1. 2026-11-20 — leads: favoritos sustituidos por prioridad (`low/medium/high/critical`) en dropdown, orden por prioridad en servidor y cliente, y migración D1 con backfill (`favorite=1` → `high`) más borrado de la columna antigua, aplicada en local y remota.
2. `97361e0` — breadcrumb siempre visible arriba a la izquierda (incluido RTL y rutas sin mapear) y menú público oculto en `/stage1` anónimo.
3. `e94d19f` — migración `favorite` aplicada a BD local por defecto y D1 remota (fix de "Could not update the row" al marcar favoritos).
4. `495b056` — tabla de leads: `thead`/`tbody` alineados (selección → favorito) y `.favorite-check` para el toggle de favorito.
5. `336e495` — aviso de email duplicado al hacer blur en readiness, Stage 1 y perfil.
6. `17f26dd` — `USER.EMAIL_EXISTS` movido a nivel superior en los 7 idiomas.
7. `38f5c55` — columna Country más ancha y panel del dropdown limitado al ancho disponible.
8. `bc9007a` — perfil sin `region`; `country` dentro de "About your organisation".
9. `588f372` — renombrado a Pre-Accreditation en UI/i18n/correos.
10. `cb1c220` — persistencia de `favorite` en D1 (schema + migración + insert/update/read).
11. `632895a` — handlers de favoritos corregidos (`$any($event.target).checked`).
12. `029fa28` — CTA "Get assessed" oculto con sesión iniciada.

## Decisiones recientes

- Terminología: **texto visible** "Pre-Accreditation"; **identificadores** (`PRESCREENING`, `preScreeningStatus`, `'pre-screening'`) se mantienen por compatibilidad.
- Prioridad de leads: `low | medium | high | critical` (mismos valores que `organizations.priority_level`), default `low`. El orden se aplica en el servidor (`ORDER BY CASE priority` en `listLeads`) y en cliente (`filteredLeads`), estable para prioridades iguales. Los antiguos favoritos se migraron a `high` y la columna `favorite` se eliminó.
- Notas de revisión: snapshot en el momento de enviar (`markReviewSent`); las ediciones posteriores del admin no cambian lo que ve el solicitante.
- Email duplicado: comprobación de UX con cuentas activas en memoria, se limpia al volver a escribir; la validación real sigue siendo del servidor.
- Archivos del admin: agrupación por origen con `DOCUMENT_GROUP_ORDER` en `worker/index.ts`; cabeceras traducidas con `FILES_GROUP_*`.
- Country: solo este campo en los formularios; sección huérfana fusionada con la tarjeta siguiente.

## Próximas tareas recomendadas

1. Hacer push y confirmar que el repositorio remoto queda sincronizado.
2. Mover la comprobación de email a un endpoint `/api/users/check-email` (o similar), reutilizando la restricción `users.email` única.
3. Añadir tests de regresión para: prioridad de leads (cambio + persistencia + orden), aviso de email en blur y panel de notas del solicitante.
4. Configurar `RESEND_API_KEY` en un entorno de prueba y revisar el correo de estado "Passed" (debe indicar que Stage 2 está accesible).

## Archivos y módulos importantes por tarea

| Tarea | Archivos |
| --- | --- |
| Stage 1 / pre-acreditación | `pages/stage1/stage1.component.*`, `shared/components/stage1-steps/*`, `shared/data/form-steps.config.ts`, `prescreening_Stage1.pdf` |
| Stage 2 / acreditación | `pages/stage2/stage2.component.*`, `shared/data/stage2-form.config.ts`, `fullform_AA_Stage2.pdf` |
| Readiness | `pages/readiness/readiness-wizard.component.*`, `readiness-application.model.ts`, `api/drafts` + `api/readiness` |
| Leads y prioridad | `models/applicant.model.ts`, `pages/dashboard/leads-import/*`, `worker/index.ts` (`listLeads`, `updateLead`), `worker/schema.sql`, `worker/migrations/2026-11-20_leads_priority.sql` |
| Breadcrumb y layout | `layout/layout.component.*`, `shared/components/breadcrumb/*`, `services/breadcrumb.service.ts` |
| Review notes y dashboard solicitante | `pages/dashboard/submission-detail/submission-detail.component.ts`, `services/storage.service.ts`, `models/applicant-dashboard.model.ts`, `pages/dashboard/applicant/*`, `worker/index.ts` (`markApplicantReviewSent`, `organizationDashboard`) |
| Organizaciones y Files | `pages/admin/organizations/admin-organization-edit.*`, `models/organization.model.ts`, `worker/index.ts` (`DOCUMENT_SECTIONS`, `listOrganizationFiles`) |
| Cuentas y sesión | `services/auth.service.ts`, `services/user.service.ts`, `guards/auth.guard.ts`, `pages/settings/user-management/*`, `worker/index.ts` (`users`, `user_tokens`) |
| Correo e i18n | `worker/email.ts`, `services/email.service.ts`, `src/assets/i18n/*.json`, `config/email.config.ts` |
| Infraestructura | `wrangler.jsonc`, `worker/schema.sql`, `worker/migrations/*`, `proxy.conf.json`, `angular.json`, `scripts/*` |

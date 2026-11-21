# AGENTS.md — instrucciones permanentes para agentes de IA

> **Antes de empezar cualquier tarea, lee `PROJECT_STATUS.md`** (estado real, decisiones recientes y tareas pendientes).
> **Al terminar una tarea importante, actualiza `PROJECT_STATUS.md`** con lo cambiado, verificado y lo que queda.

## 1. Descripción y objetivo

Portal de **Avera Capital Access** para el proceso de acreditación del **GCF (Green Climate Fund)**: captación de leads, evaluación de perfil, cuestionario de **pre-screening** (Stage 1), solicitud de **accreditation** (Stage 2), solicitud **Readiness**, y panel de administración de solicitudes, organizaciones, usuarios y correos.

El repositorio se llama `gcf` y el proyecto Angular `nuriberry-app` (el `README.md` raíz aún conserva el título original "Climat Advisor"). La UI está en inglés con i18n; el equipo trabaja en español.

## 2. Arquitectura y tecnologías

- **Frontend**: Angular 18 (componentes `standalone`), TypeScript 5.5 (`strict`, `strictTemplates`, `noImplicitReturns`), RxJS 7, CSS por componente.
- **Backend**: un único **Cloudflare Worker** (`worker/index.ts`, Wrangler 4) que sirve el SPA estático (`dist/nuriberry-app/browser`, SPA fallback) y todas las rutas `/api/*` (`run_worker_first`).
- **Datos**: Cloudflare **D1** (`averacapital-db`, binding `DB`) y **R2** (`averacapital-documents`, binding `DOCUMENTS`).
- **Correo**: Resend (`RESEND_API_KEY`) con plantillas en `worker/email.ts`; si falta la clave, algunas acciones devuelven 501 y la UI usa Gmail compose.
- **i18n**: `@ngx-translate/core` + `http-loader`, 7 idiomas en `src/assets/i18n/*.json` (`en`, `es`, `fr`, `ru`, `zh`, `ar`, `vi`), `en` por defecto.
- **Otros**: `xlsx` (importación de leads), `d3` y `three` (mapa/globo del dashboard), `firebase` y reglas/export (legado de migración), Karma/Jasmine para tests.

## 3. Estructura de carpetas

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/app.routes.ts`, `app.config.ts` | Rutas y providers (router, HttpClient, translate) |
| `src/app/config/` | URLs del API, attachments y correo (`REMOTE_API_BASE_URL`, `API_TOKEN_STORAGE_KEY`) |
| `src/app/guards/` | `authGuard`, `adminGuard`, `preScreeningGuard` (Stage 2 requiere estado `Passed`) |
| `src/app/layout/` | Cabecera/sidebar del portal; navegación y menú de usuario |
| `src/app/models/` | Interfaces y tipos compartidos (applicant, organization, dashboard, stats, email, attachment) |
| `src/app/pages/` | Pantallas: `landing`, `get-assessed`, `profile-assessment`, `stage1`, `stage2`, `readiness`, `dashboard/*`, `admin/organizations/*`, `settings/*`, `my-forms`, `pricing`, `auth`, `login` |
| `src/app/services/` | `api`, `auth`, `storage`, `user`, `organization`, `attachment`, `email`, `language`, `notification`, `breadcrumb` (la mayoría `providedIn: 'root'`) |
| `src/app/shared/` | Componentes reutilizables (`country-select`, `file-upload`, `chat`, `confirm-dialog`…), datos de formularios y utilidades |
| `src/assets/i18n/` | Los 7 archivos de traducción |
| `worker/index.ts` | Todas las rutas `/api/*`, cálculo de métricas, emails, orden de archivos |
| `worker/email.ts` | Plantillas HTML/texto de correos |
| `worker/schema.sql` | Esquema D1 idempotente + datos semilla |
| `worker/migrations/` | Migraciones D1 de una sola ejecución (columnas nuevas) |
| `scripts/` | Migración Firestore→D1, smoke test API, mapa mundial, favicons, utilidades i18n |
| `public/`, `src/assets/` | Favicon/manifiesto y recursos estáticos (p. ej. `world-countries.geo.json`) |

## 4. Convenciones y estándares

- Componentes `standalone`, con `selector` prefijado `app-`, `templateUrl` y `styleUrl/.css`. Se usa `inject()` en código nuevo; hay componentes antiguos con inyección por constructor (no reescribir sin motivo).
- Angular 18: plantillas con `@if`/`@for` en código reciente; aún quedan `*ngIf`/`*ngFor` en archivos antiguos. Respetar el estilo del archivo que se edita.
- Formularios: `ngModel`/`FormsModule` en wizards más nuevos; `FormGroup`/`ReactiveFormsModule` en Stage 1/2. No mezclar dentro del mismo control.
- TypeScript estricto: evitar `any`; usar `as` o `$any()` solo en plantillas cuando el tipo del evento lo exige (p. ej. `$any($event.target).checked`).
- i18n: claves `UPPER_SNAKE_CASE` agrupadas por sección (`NAV.*`, `PROFILE.*`, `ADMIN_ORGANIZATION_EDIT.*`). Toda clave nueva se añade a **los 7 idiomas**. Las claves existentes son estables: renombrar solo el valor, nunca la clave.
- CSS: clases con prefijo de componente (`.cs-` country-select, `.avera-` landing, `.ao-` admin organizations). Sin frameworks CSS.
- Nomenclatura TS: `camelCase` para variables/funciones, `PascalCase` para clases/interfaces/tipos, `UPPER_SNAKE_CASE` para constantes.
- Commits: mensajes `tipo(ámbito): descripción` en inglés; cambios pequeños y separados por responsabilidad.

## 5. Patrones arquitectónicos

- **Un solo identificador de organización**: `organizations.id` = id del applicant = carpeta R2 `organizations/<id>/...` = clave de drafts (`stage1_drafts`, `readiness_drafts`) y de `readiness_applications`. Los visitantes anónimos reciben un id en la URL (`?org=<id>`); los usuarios autenticados usan su `organizationId`.
- **Borradores**: autoguardado en D1 (`GET/PUT /api/drafts/...`); los envíos guardan el payload JSON completo, por lo que añadir campos al formulario **no requiere migración**.
- **Puerta de acceso**: solo `preScreeningStatus === 'Passed'` desbloquea Stage 2 (`preScreeningGuard`). Los admins siempre pasan.
- **Sesión**: `sessionStorage['current_user']` y token Bearer en `sessionStorage['api_token']`. `UserService` es un listado en memoria con cuentas semilla, usado como fallback offline / para comprobaciones rápidas; la fuente real es la tabla D1 `users`.
- **Correos best-effort**: un fallo de Resend nunca debe fallar el envío del formulario ni el cambio de estado.
- **API**: rutas relativas `/api/*` (proxy del dev server a `:8787`); `resolveApiUrl()` soporta un Worker remoto para despliegues Vercel.
- **Archivos**: R2 `<scope>/<entityId>/<section>/<uuid>-<nombre>`; el admin agrupa/ordena por origen (`readiness → prescreening → accreditation → other`) y después por sección.

## 6. Dependencias importantes

`@angular/*` 18.2, `@ngx-translate/core` + `http-loader` 18, `rxjs` 7.8, `typescript` 5.5, `xlsx` 0.18, `d3` 7, `three` 0.187, `firebase` 12, Wrangler 4 (vía `npx`), `concurrently`, Karma/Jasmine. No añadir librerías sin necesidad; hay utilidades propias para mapa y generación de favicons.

## 7. Reglas al modificar código existente

1. No cambiar claves i18n, identificadores de `SubmissionForm` (`'pre-screening'`, `'stage 2'`, `'readiness'`), nombres de secciones R2 ni nombres de campos JSON: son contratos con datos ya guardados. La terminología visible es "Pre-screening" (se probó "Pre-Accreditation" y se revirtió), pero las claves internas siguen siendo `PRESCREENING`/`preScreeningStatus`.
2. Cambios en D1: `schema.sql` es idempotente para bases nuevas; las columnas nuevas de bases existentes van en `worker/migrations/*.sql` y hay que aplicarlas en local **y** en remoto.
3. Toda cadena visible nueva pasa por i18n en los 7 idiomas (o se documenta como texto fijo deliberado).
4. No tocar `.dev.vars`, secretos ni IDs de recursos desplegados. No commitear datos de solicitantes (`firestore-export.json` y `worker/import.sql` están ignorados).
5. Los estados de review se envían como **snapshot**: `markReviewSent` guarda las notas en el momento del envío; ediciones posteriores del admin no alteran lo que ve el solicitante.
6. Antes de dar por terminado un cambio, ejecutar los tres chequeos de la sección 9 y revisar `git diff` para detectar cambios accidentales de fin de línea (el repo usa LF en el índice con `core.autocrlf=false`; un script que reescriba CRLF puede generar diffs de fichero completo).

## 8. Seguridad

- Secretos: `API_TOKEN`, `ADMIN_ACCOUNTS`, `ADMIN_PASSWORD`, `RESEND_API_KEY` se configuran con `wrangler secret put` o en `.dev.vars` (ignorado). Nunca en el código.
- Contraseñas: PBKDF2-SHA256 (`pbkdf2$100000$salt$hash`) en D1; tokens de un solo uso en `user_tokens` (reset 60 min, invitación 7 días).
- Endpoints de admin requieren `Authorization: Bearer <API_TOKEN>`. Algunas rutas de organización son públicas por diseño (no hay token para el solicitante anónimo).
- No exponer PII en fixtures, logs ni archivos versionados. `GET /api/users` no devuelve hashes.

## 9. Ejecutar y probar

```powershell
npm install                       # una vez
npm run start:all                 # Worker (:8787) + Angular (:4200), /api proxyado
npm run start                     # solo Angular (necesita el Worker en :8787)
npm run worker:dev                # solo Worker
```

- El proxy está en `proxy.conf.json` (`/api` → `http://localhost:8787`). `.dev.vars` incluye `API_TOKEN=local-dev-token`; sin `RESEND_API_KEY` no hay correos reales.
- Para un persist dir distinto: `npx wrangler dev --port 8787 --persist-to <dir>`; aplicar migraciones con `wrangler d1 execute averacapital-db --local|--remote --persist-to <dir> --file=...`.
- Verificaciones obligatorias antes de commit:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx tsc --noEmit -p tsconfig.app.json
npm run worker:typecheck
npx ng build
```

- `ng test` usa Karma (pocos specs, la mayoría de servicios); no hay e2e configurado.
- Despliegue: `npm run build` y `npx wrangler deploy` (Workers Builds usa esos mismos comandos). Detalle completo de rutas y despliegue en `worker/README.md`.

## 10. Decisiones arquitectónicas importantes

- Un único Worker sirve SPA + API; no hay backend independiente.
- D1 guarda payloads JSON completos: los formularios evolucionan sin migraciones de columnas.
- Solo el estado `Passed` abre Accreditation; el guard consulta `GET /api/organizations/:id/forms`.
- Las notas de revisión enviadas al solicitante son una instantánea; se publican en `GET /api/organizations/:id/dashboard` (público) y se muestran en el panel "Review feedback".
- La pestaña Files del admin ordena primero por origen (readiness, pre-screening, accreditation) y después por sección, con metadatos en `worker/index.ts` (`DOCUMENT_SECTIONS`, `DOCUMENT_GROUP_ORDER`).
- Logout redirige a `/home`; el CTA "Get assessed" de la cabecera de la landing se oculta cuando hay sesión iniciada.
- La comprobación de email duplicado al salir del campo usa `UserService.findByEmail()` (solo cuentas activas de la lista en memoria) y avisa con `USER.EMAIL_EXISTS` en los 7 idiomas. Es una comprobación de UX, no una validación autoritativa: el servidor sigue siendo la fuente de verdad.
- Eliminación del campo `region`: solo se conserva `country` en los formularios; la sección que quedaba vacía se fusionó con la tarjeta de organización.
- La terminología visible es "Pre-screening"; los identificadores internos se mantienen por compatibilidad con datos guardados.
- La pestaña Forms del admin muestra una tarjeta por vía (pre-screening, acreditación, readiness) con metadatos de la presentación y enlace al formulario; el admin abre Stage 1 ya enviado mediante `forms.stage1.data` (fallback en `stage1.component.ts`).
- El menú "Accreditation Subm." (`/dashboard/accreditation`) mezcla el historial de `accreditation_submissions` con los pre-screenings `Passed`; cada fila abre el full form de Stage 2 con `?org=<id>&submission=<id>` y el autoguardado se desactiva en esa vista. Los borradores de Stage 2 son uno por organización (sin selector de año).
- Las cuatro tablas admin (Leads, Pre-screening, Readiness, Accreditation) usan un flag `archived` y un toggle "Archivados (N)": archivar/restaurar es una acción masiva con los checkboxes, sin columna Archive por fila. `PATCH /api/admin/archive` es el endpoint genérico; Accreditation Subm. también admite borrado definitivo con checkbox (`DELETE /api/accreditation/submissions`, los ids `prescreening:<orgId>` borran el applicant). Su acción de editar es un lápiz y su columna Status es editable con `Pending | Passed | Failed` (`PATCH /api/accreditation/submissions/:id/status`); no hay columna de pre-screening en esa tabla.
- El pre-screening del full form de Stage 2 **no** es una copia antigua: `/stage1` y `/stage2` comparten `app-stage1-steps`, `addStage1FormControls()` y `watchStage1ConditionalRequirements()`. Los extras exclusivos de Stage 2 van detrás de `[applicationMode]="true"`. No volver a introducir un segundo template de pre-screening.

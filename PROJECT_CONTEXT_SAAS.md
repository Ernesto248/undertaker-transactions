# PROJECT CONTEXT SAAS (MASTER)

## 0) Proposito del documento

Este documento resume TODO el contexto funcional y tecnico definido para crear un nuevo proyecto SaaS basado en el flujo actual.
Objetivo: que cualquier agente o dev pueda arrancar con contexto completo sin perder decisiones ya tomadas.

Ultima actualizacion: 2026-04-04

---

## 1) Idea general del producto

Construir un SaaS para capturar correos de bancos (principalmente USA), extraer datos de transacciones, guardarlos en base de datos y operar esas transacciones en un dashboard (asignacion a remeseros, pagos, balances, etc).

### Perfil de uso

- Un cliente se registra en nuestra app.
- Paga una suscripcion.
- Conecta una o varias cuentas de Gmail.
- Esas cuentas conectadas pueden ser del mismo cliente o de terceros autorizados.
- El sistema procesa correos entrantes y crea transacciones en DB.

### Regla de consentimiento

Si una cuenta de correo no es del cliente principal, igual debe haber consentimiento OAuth explicito del duenio del buzon.

---

## 2) Decisiones clave ya definidas

1. No usar n8n en este proyecto (ni core ni automatizaciones secundarias).
2. Ingestion principal directa desde backend usando Gmail API.
3. Empezar con polling cada 5 minutos (MVP).
4. Mantener arquitectura lista para migrar luego a Gmail Watch + Pub/Sub.
5. Base de datos inicial: una sola DB Neon compartida, pero multi-tenant real.
6. Auth por cliente y aislamiento estricto de datos por tenant.
7. Landing page no es prioridad al inicio; primero producto (auth + onboarding + dashboard).
8. v0 se puede usar para generar UI inicial, pero NO para logica critica.

---

## 3) Estado actual del proyecto de referencia

Proyecto actual (referencia funcional):

- Stack: Next.js, React, TypeScript, Neon Postgres, Zod, Tailwind, componentes UI.
- Dominios ya validados: transactions, remeseros, assignments, payments, account movements.
- Integracion actual de ingestion existe via endpoint HTTP.
- Limitacion actual: orientado a single-tenant (sin aislamiento SaaS completo por tenant).

Esto sirve como referencia de flujo y UX, no como arquitectura final multi-tenant.

---

## 4) Arquitectura objetivo del nuevo SaaS

### 4.1 Componentes principales

- Frontend web (dashboard + onboarding + settings)
- Backend API (auth, tenant, ingestion, operaciones)
- Worker de polling Gmail (cada 5 min)
- Neon Postgres (multi-tenant)
- Sistema de logs y metricas
- Billing/suscripciones

### 4.2 Multi-tenant

Cada tabla de negocio debe incluir tenant_id.

Aislamiento obligatorio:

- Filtros por tenant_id en todas las queries
- RLS (row level security) en DB
- Indices compuestos incluyendo tenant_id
- Unicidad por tenant (ej: tenant_id + message_id)

### 4.3 Escalado futuro

- Fase 1: DB compartida multi-tenant
- Fase 2: modelo hibrido (shared + dedicated para enterprise)

---

## 5) Flujo funcional de correos (MVP)

### 5.1 Onboarding de mailbox

1. Cliente conecta una cuenta Gmail via OAuth.
2. Guardar tokens de forma segura (cifrado).
3. Crear etiqueta Guardado en ese mailbox si no existe.
4. Registrar mailbox en DB con estado activo.

### 5.2 Polling (cada 5 min)

1. Worker busca mailboxes activos.
2. Lee correos nuevos usando Gmail API.
3. Parsea informacion de transaccion.
4. Inserta en DB con idempotencia (evitar duplicados).
5. Marca correo con etiqueta Guardado.
6. Guarda trazabilidad de procesamiento (ok/error/retry).

### 5.3 Parseo multi-banco (HTML distinto por banco)

No se permite un flujo por banco/cuenta. Se implementa un parser engine centralizado.

1. Clasificacion inicial del email por senales: from, dominio, subject, snippets y patrones.
2. Seleccion de parser por parser_key y version.
3. Reglas de extraccion definidas en configuracion (selectores/regex/transforms), no hardcodeadas por flujo.
4. Validacion de salida obligatoria: monto, fecha, cuenta/banco, codigo de confirmacion cuando aplique.
5. Fallback a cola de revision manual cuando no parsea o parsea con baja confianza.
6. Registro de metricas por parser (success rate, error rate, tiempo de parseo).

Regla SaaS:

- Configuracion global por banco.
- Overrides por tenant si un cliente recibe una variante de template distinta.

### 5.4 Asignacion a remesero

Cuando una transaccion se asigna a un remesero:

- Marcar STARRED en el correo asociado.

Cuando se desasigna :

- Quitar STARRED.

---

## 6) Google Cloud Console (obligatorio)

### 6.1 Configuracion base

1. Crear proyecto en Google Cloud.
2. Habilitar Gmail API.
3. Configurar OAuth Consent Screen (External).
4. Crear OAuth Client (Web app).
5. Definir redirect URIs correctos para backend/app.

### 6.2 Scopes minimos sugeridos

- openid
- email
- profile
- gmail.readonly
- gmail.modify (si se aplican label/star)

### 6.3 Produccion

- Solicitar verificacion de Google si aplica por scopes/volumen.
- Preparar politicas de privacidad y terminos claros.

---

## 7) Modelo de datos minimo sugerido (nuevo proyecto)

Tablas nucleares sugeridas:

- tenants
- users
- tenant_users (roles/permisos)
- subscriptions
- mailboxes (por tenant)
- mailbox_oauth_tokens (cifrados)
- mailbox_labels (incluye label Guardado)
- emails_raw (metadatos, payload controlado)
- parsed_transactions
- remeseros
- remesero_assignments
- remesero_payments
- account_movements
- ingestion_jobs
- ingestion_events
- audit_logs

### Unicidad e idempotencia

- UNIQUE (tenant_id, mailbox_id, gmail_message_id)
- UNIQUE (tenant_id, bank_id, confirmation_code) cuando aplique

---

## 8) Seguridad y cumplimiento

1. OAuth por cada mailbox conectado.
2. Tokens cifrados en reposo.
3. Rotacion de secretos.
4. RLS habilitado.
5. Auditoria de acciones criticas.
6. Politica de retencion de datos.
7. Evitar almacenar mas contenido de correo del necesario.

Riesgos que NO se deben ignorar:

- revocacion de tokens
- cuotas API de Gmail
- duplicados por reintentos
- mezcla de datos entre tenants

---

## 9) Frontend: orden recomendado

No empezar por una landing compleja.

Secuencia recomendada:

1. Auth + alta de tenant
2. Onboarding de suscripcion
3. Conectar mailbox Gmail
4. Dashboard de transacciones
5. Asignacion a remeseros
6. Configuracion por cliente (branding, limites, usuarios)
7. Landing y marketing

---

## 10) Integraciones y automatizaciones

Todas las automatizaciones se resuelven dentro del backend y workers propios:

- polling de correos
- parseo
- etiquetado Guardado
- marcado STARRED por asignacion
- notificaciones y reportes

---

## 11) Casos de uso principales

1. Cliente se registra y activa suscripcion.
2. Cliente conecta 1..N mailboxes Gmail.
3. Sistema crea etiqueta Guardado por mailbox.
4. Sistema detecta correos nuevos por polling.
5. Sistema parsea y guarda transacciones.
6. Sistema etiqueta correo como Guardado.
7. Operador asigna transaccion a remesero.
8. Sistema marca correo como STARRED.
9. Cliente consulta dashboard y movimientos.
10. Sistema maneja errores y reintentos sin duplicar datos.

---

## 12) KPI y observabilidad minima

KPI sugeridos:

- tiempo medio desde recepcion de correo hasta insercion DB
- porcentaje de parse exitoso
- porcentaje de duplicados evitados
- errores por mailbox
- revocaciones OAuth
- costo por tenant

Logs obligatorios:

- tenant_id
- mailbox_id
- message_id
- estado (processed/duplicate/error)
- motivo de error

---

## 13) Plan tecnico por fases

### Fase 1 (MVP)

- multi-tenant DB
- auth + suscripcion basica
- conexion Gmail OAuth
- polling 5 min
- parse + insercion + label Guardado
- dashboard base

### Fase 2

- hardening seguridad + auditoria
- mejores retries y DLQ
- feature flags por plan
- mejores reportes

### Fase 3

- migracion parcial o total a Gmail Watch + Pub/Sub
- mejoras de escalado
- opcion enterprise con aislamiento dedicado

---

## 14) No-negociables de arquitectura

1. Nada de datos sin tenant_id.
2. Nada de tokens en texto plano.
3. Nada de n8n en este proyecto.
4. Nada de endpoints sin auth en operaciones de negocio.
5. Nada de inserciones sin idempotencia.

---

## 15) Prompt base para iniciar un proyecto nuevo

Copiar y pegar al iniciar nuevo proyecto:

"Quiero crear un SaaS multi-tenant para capturar emails bancarios de Gmail, parsear transacciones y gestionarlas en dashboard. Requisitos obligatorios: auth por cliente, suscripciones, multiples mailboxes por tenant, polling cada 5 minutos (MVP), etiqueta Guardado al procesar, marcar STARRED cuando se asigna a remesero, Neon Postgres compartido con tenant_id + RLS, idempotencia por tenant/mailbox/message_id, tokens OAuth cifrados, observabilidad por tenant, parser engine centralizado y versionado para manejar HTML distinto por banco, overrides por tenant y cola de revision manual. No usar n8n en ninguna parte del proyecto."

---

## 16) Nota final

Este documento es la fuente de verdad inicial del nuevo proyecto.
Si cambia una decision de arquitectura o negocio, actualizar este archivo primero.

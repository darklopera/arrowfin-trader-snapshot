# SEGURIDAD

El modelo de amenaza en una línea: **un trader legítimo y autenticado del broker A intenta leer, o recibir, algo que pertenece al broker B (o a otro trader de A).** Un fill enviado al tenant equivocado es el peor resultado posible aquí, así que ese es el atacante contra el que diseñé. Cada afirmación de abajo tiene una prueba.

## 1. Modelo de autenticación

**REST.** Toda ruta exige `Authorization: Bearer <JWT>`. El guard es global (`APP_GUARD`), así que autenticarse es lo predeterminado y salirse requiere un `@Public()` explícito: si alguien olvida el decorador, la ruta falla cerrada con un 401. El token se verifica en `auth/token.service.ts`:

- `HS256` está fijado, así que los tokens con `alg: none` o con confusión de algoritmo se rechazan antes de leer cualquier claim.
- `issuer`, `audience` y `exp` son obligatorios.
- La identidad son dos claims, `sub` (trader) y `bid` (broker/tenant), ambos revalidados con patrones estrictos. El token lleva solo ids: ni nombre, ni correo, ni balance.
- Todo fallo devuelve el mismo 401 genérico, para que quien llama no sepa por qué falló.

El resultado es un `TenantScope {brokerId, traderId}` que se crea **únicamente** ahí. Ninguna ruta de código lo construye a partir de una URL, un body, un query string o un header.

**WebSocket.** La autenticación ocurre al conectar, en el middleware del handshake de Socket.IO (`realtime/fills.gateway.ts`), nunca por mensaje. El token viaja en el `auth` del handshake y no en la URL, que terminaría en los logs de los proxies (una prueba confirma que un token en el query string se rechaza). Sin token válido la conexión ni siquiera existe, y el servidor cierra el socket cuando el JWT expira.

**¿Qué impide que el tenant A se suscriba al flujo del tenant B?** No hay nada que invocar. El *servidor* decide a qué salas entra un socket: las cuentas que el trader del token posee dentro del broker del token, con el broker dentro del nombre de la sala (`acct:{broker}:{account}`). El gateway **no tiene manejadores de mensajes entrantes**, así que un cliente no puede pedir unirse a nada. `test/ws.e2e-spec.ts` demuestra que un fill llega solo a su dueño (no a un colega del mismo broker ni a otro broker), y que un atacante que emite `join` o `subscribe` sobre la sala de otro no recibe nada.

## 2. Aislamiento de tenant

Tres capas independientes, para que un solo error nunca baste:

1. **La identidad se deriva, nunca se recibe.** El tenant sale del token verificado. El único identificador que manda el cliente es `accountId`, que se contrasta con el token y nunca se da por bueno.
2. **Cada consulta repite el alcance y los tipos lo obligan.** Los métodos del repositorio reciben un `TenantScope`, así que llamar a la capa de datos sin él no compila. Las consultas usan `select`, nunca `SELECT *`, de modo que una columna añadida después no se filtra por accidente (`snapshot/infrastructure/prisma-snapshot.repository.ts`).
3. **La base de datos se niega por su cuenta.** Row Level Security (`ENABLE` + `FORCE`) en toda tabla con `broker_id`. La aplicación se conecta como `arrowfin_app`: sin ser dueña, sin ser superusuario, sin `BYPASSRLS` y solo con `SELECT`. Cada transacción empieza con `set_config('app.broker_id', …, true)`, limitado a la transacción para que una conexión del pool no filtre el tenant anterior. Las llaves foráneas compuestas hacen imposible guardar un fill que apunte a la cuenta de otro broker.

**Si alguien olvida `WHERE broker_id = ?` dentro de seis meses, ¿qué lo atrapa?** No lo supuse; rompí el código a propósito:

| Mutación | Resultado |
| --- | --- |
| Quitar `brokerId` y `traderId` de la búsqueda de la cuenta | Las pruebas entre tenants siguen pasando (RLS no devuelve nada), pero falla la prueba de *mismo broker, otro trader*. |
| Olvidar abrir la transacción del tenant | Fallan 37 pruebas, y en producción la consulta devuelve **cero filas** (falla cerrado). |
| Tabla nueva con `broker_id` y sin política | Una prueba guardián en `test/db-rls.e2e-spec.ts` rompe el build. |

El límite, dicho con honestidad: **RLS aísla por tenant, no por trader.** El aislamiento entre dos traders del mismo broker depende de la cláusula `WHERE traderId` y de su prueba, que es una garantía más débil. Endurecerlo implica agregar `app.trader_id` a la política.

## 3. Manejo de PII

**Lo que consideré sensible.** Las columnas estructuradas de `traders.csv` (nombre, correo, teléfono, fecha de nacimiento, `ssn_last4`, dirección), los balances de las cuentas y, sobre todo, el texto libre de `notes` y `audit_notes`: contienen datos bancarios, números de identificación nacional, rutas a documentos KYC y números de casos de cumplimiento. El texto libre es lo más peligroso porque nadie lo sanea.

**Decisión principal: minimización.** El cargador de datos conserva solo `id, broker_id, kyc_status, created_at` de `traders.csv` y descarta `api_key_hash` de `brokers.csv`. Un dato que no guardamos no se puede filtrar ni registrar. Una prueba comprueba que esas columnas no existen, y los CSV del repositorio (`dataset/`) están sanitizados de la misma forma.

| Superficie | Contiene | Excluye a propósito |
| --- | --- | --- |
| Base de datos | ids, estado KYC, número de cuenta, balance, fills | nombres, contacto, fecha de nacimiento, SSN, dirección, notas |
| Respuesta REST / evento WebSocket (misma forma) | posiciones, P&L, puntaje de riesgo, cuenta enmascarada (`••••0001`) | **balance**, número de cuenta completo, datos de identidad |
| Logs | método, plantilla de ruta, estado, duración, ids de trader y broker | bodies, query strings, payloads, headers, tokens |
| Navegador | snapshot en memoria; token en `sessionStorage` (demo) | nada en caché (`Cache-Control: no-store`) |

**Qué registro y qué redacto.** Registro ids seudónimos y la plantilla de la ruta (no la URL cruda, para que un texto controlado por el atacante no pueda falsificar líneas de log). "Redacto" simplemente no registrando payloads, lo cual es más sólido que una expresión regular sobre texto libre.

**Base de datos frente a WebSocket.** En la base de datos la PII es un problema de datos en reposo: RLS la acota, el rol es de solo lectura y en producción añadiría cifrado por columna (KMS), respaldos cifrados y reglas de retención. Por el WebSocket es irrevocable: cuando un frame llega al navegador no puedo recuperarlo. Por eso el socket lleva lo mínimo (el mismo snapshot con lista de campos permitidos, sin balance), exige `wss` en producción, está atado a una credencial que expira y no se puede dirigir a una sala que el servidor no eligió.

## 4. Una vulnerabilidad que no introduje: BOLA / IDOR sobre `accountId`

Es el error del pull request de la Tarea 4 y la forma habitual en que se filtra una API multi-tenant: el cliente nombra un objeto, el servidor lo busca y nadie pregunta si *este usuario* puede verlo. La línea que lo previene, en `prisma-snapshot.repository.ts`:

```ts
where: { id: accountId, brokerId: scope.brokerId, traderId: scope.traderId }
```

Desde el lado del atacante (un trader de un broker que adivina los ids secuenciales de otro):

| Ataque | Por qué falla |
| --- | --- |
| `GET /v1/me/snapshot?accountId=ACC-1001` (cuenta de otro broker) | La búsqueda incluye mi broker y mi trader: no es mía, no se encuentra. |
| Distinguir "existe pero no es tuya" de "no existe" | Ambos casos devuelven el mismo `404` (probado): no hay oráculo de existencia. |
| `?brokerId=…&traderId=…` | `forbidNonWhitelisted`: responde 400 y nunca lee esos parámetros. |
| Token falsificado o degradado | `alg:none`, secreto equivocado, audiencia equivocada, sin `exp` y claims mal formados dan 401 (todo probado). |
| Inyección o falsificación de logs por `accountId` | `^ACC-\d{1,10}$` se valida antes de que el valor llegue a una consulta o a un log. |

**El simulador de desarrollo no puede correr en producción** (lo pide `simulate-fills.md`), mediante cuatro protecciones independientes: (1) `DevModule` (`POST /dev/fills`) solo se importa si `ENABLE_DEV_ENDPOINTS=true` **y** `NODE_ENV !== 'production'`; si no, las rutas no existen; (2) `loadConfig()` se niega a arrancar si ambas condiciones se dan juntas (probado con pruebas unitarias); (3) el endpoint exige su propia `x-dev-key`, comparada en tiempo constante, y un JWT de usuario no sirve; (4) escribe por una conexión privilegiada aparte que solo se crea dentro de ese módulo, así que la API de producción nunca tiene credenciales capaces de escribir.

## 5. Lo que haría en producción y no hice

**Límite de tasa** por IP y por trader, un tope de sockets simultáneos por trader y un control de intentos de login. **Registro de auditoría**: un historial de solo agregar con quién consultó qué cuenta y cuándo, guardado donde la aplicación no pueda editarlo. **Redacción estructurada**: un logger con lista de campos permitidos y una verificación en CI que falle si se registra un payload. **Cifrado**: cifrado de sobre con KMS para balances y cualquier columna futura con PII, TLS en todo (`wss`, `verify-full` hacia la base de datos) y secretos en un gestor con rotación. **Tokens**: firma asimétrica con el JWKS del proveedor de identidad en lugar de un secreto HS256 compartido, tokens de acceso de corta vida con refresh en una cookie httpOnly detrás de un BFF (el `sessionStorage` actual es una concesión de la demo, legible por cualquier XSS) y una lista de bloqueo para que un trader suspendido deje de funcionar de inmediato. **Frontend**: una CSP con nonces (hoy `script-src` necesita `'unsafe-inline'` por el arranque de Next). **Escala**: el adaptador de Redis para Socket.IO. **Proceso**: escaneo de dependencias y secretos en CI, una prueba de penetración sobre la frontera entre tenants y un procedimiento de incidentes que trate "un fill llegó al tenant equivocado" como un evento reportable.

# ArrowFin: Trader Daily Snapshot (versión en español)

> **Tiempo invertido:** unas 2 horas.
> **Uso de IA:** sí. Trabajé en conjunto con Claude (Claude Code): yo definí el alcance y aprobé el enfoque como arquitecto; Claude se encargó de la implementación (código, pruebas, verificación y apoyo en la redacción). El detalle, y lo que cambiaría si lo hubiera escrito yo a mano, está en la sección [Uso de IA](#uso-de-ia).

Es un widget que le muestra a un trader sus posiciones abiertas, su P&L del día y un indicador de riesgo, y que se actualiza en tiempo real por un WebSocket aislado por tenant. El backend usa NestJS, Prisma y PostgreSQL; el frontend usa Next.js 15, Tailwind y TanStack Query.

En el repositorio también están [`SECURITY.es.md`](./SECURITY.es.md) (Tarea 3) y [`CODE_REVIEW.es.md`](./CODE_REVIEW.es.md) (Tarea 4). La Tarea 5 está al final de este archivo. Cada documento tiene su versión en inglés al lado (`README.md`, `SECURITY.md`, `CODE_REVIEW.md`), para que quien revise elija el idioma que prefiera.

---

## Contexto

**Autoevaluación** (1 nunca lo he usado, 2 nivel tutorial, 3 he entregado código con esto, 4 me siento cómodo en producción, 5 podría enseñarlo)

- TypeScript: 4
- Next.js: 4
- NestJS: 2
- Prisma: 2
- PostgreSQL: 4
- WebSockets: 3
- Tailwind: 2
- JWT/auth: 4
- Aislamiento de datos multi-tenant: 2
- TanStack Query: 2
- Arquitectura hexagonal / Clean: 4
- Redis: 5

**1. ¿En qué parte de su stack soy más fuerte?**
Mi fortaleza está en la arquitectura. Me siento cómodo definiendo cómo se organiza un sistema: separar el dominio de los detalles técnicos, aplicar arquitectura hexagonal y clean, y construir implementaciones modulares que otras personas puedan entender y mantener. Me apoyo en PostgreSQL, TypeScript y Next.js, y en un manejo sólido de autenticación con JWT. Además, estoy acostumbrado a hacer integraciones desde fuentes muy distintas (servicios web, bases de datos, sistemas externos) y a que todo funcione como un solo producto.

**2. ¿Qué parte sería la curva de aprendizaje más empinada?**
Probablemente NestJS y Prisma en sus formas propias de hacer las cosas, y llevar el aislamiento multi-tenant hasta la capa de datos, por ejemplo con políticas a nivel de fila en la base de datos. Entiendo bien los conceptos y sé por qué importan, pero todavía no los he llevado a producción. Mi forma de acortar esa curva es apoyarme en lo que ya domino, como la arquitectura y SQL, y aprender el resto sobre la marcha, construyendo y revisando cada decisión.

**3. ¿Alguna tecnología fuera de su stack que considere una fortaleza?**
Sí. Tengo mucha experiencia en el diseño de APIs REST y en la integración con servicios web, incluyendo el trabajo con gestores de APIs (API Management). También me siento fuerte con Docker y CI/CD, y trabajo con SQL Server y Azure DevOps. Esa base me permite conectar sistemas distintos y llevar el código a producción de forma ordenada y repetible, no solo escribirlo.

**4. ¿Qué tipo de trabajo quiero hacer día a día?**
Me gusta diseñar arquitecturas y liderar técnicamente a un equipo, en proyectos con integraciones y sistemas que exigen rigor y que plantean retos tecnológicos reales. Lo que más me motiva es ver que lo que construimos tiene un impacto concreto: que sirva a la comunidad y a los clientes de la compañía, y no se quede solo en un buen diseño en papel.

**5. ¿Qué quiero evitar?**
Me gusta la tecnología y disfruto los retos y los desafíos nuevos, así que eso no es lo que quiero evitar. Lo que sí prefiero dejar fuera de mi ambiente de trabajo es la falta de comunicación y de respeto entre las personas. Creo que un equipo con buena comunicación y trato respetuoso resuelve casi cualquier problema técnico, y uno sin eso se complica hasta con los más sencillos.

---

## Uso de IA

Para esta prueba trabajé en conjunto con Claude. Primero analizamos el enunciado hasta entender bien el reto, los casos de uso que plantea y qué se evalúa en cada tarea. A partir de ahí, como arquitecto, fijé el rumbo: definí el alcance y qué dejar por fuera, y revisé y aprobé el enfoque de la solución (arquitectura hexagonal, aislamiento entre tenants, manejo de datos personales y estrategia de pruebas), con el objetivo de lograr una solución de calidad, segura y que cubriera todos los casos de uso de la prueba. Claude propuso alternativas y se encargó de la fase de implementación: escribió el código y las pruebas, verificó el funcionamiento, validó los resultados contra una implementación independiente y me apoyó en la redacción de los textos e informes. Yo revisé cada pieza, y las respuestas de la sección de contexto parten de mis ideas y las aprobé yo.

Para no depender solo de la palabra de la IA, el trabajo se verificó de varias maneras: los números se validan contra una reimplementación independiente en Python (`api/scripts/oracle.py`) que corre sobre los CSV originales; las pruebas de seguridad usan un PostgreSQL real y no un mock; y el código se rompió a propósito para ver qué capa atrapa qué (está en [SECURITY.es.md](./SECURITY.es.md#2-aislamiento-de-tenant)). La interfaz se probó en un navegador real: inicio de sesión, un fill en vivo, el servidor caído y restaurado, cuentas vacías y sin saldo, y ancho de celular.

**Lo que cambiaría si lo hubiera escrito a mano** (la lista honesta):

1. **Migraciones.** Las descargas del motor de Prisma estaban bloqueadas en el entorno donde se generó el código, así que el SQL de `api/prisma/migrations/` se escribió a mano (sigue las convenciones de nombres de Prisma) y se aplicó con `psql`. En una máquina normal lo regeneraría con `prisma migrate diff` y comprobaría que no haya diferencias.
2. **Método del P&L.** Claude eligió costo promedio. Yo confirmaría con el equipo de trading o riesgo si la plataforma usa FIFO antes de confiar en cualquier número.
3. **Modismos de NestJS.** Me califiqué con un 2 en NestJS. La estructura de módulos, los guards y el adaptador personalizado de Socket.IO vienen de Claude; puedo explicar cada archivo, pero alguien experto en NestJS quizá organizaría algunas cosas distinto.
4. **Interfaz.** El diseño visual es generado. Lo alinearía con el sistema de diseño de ustedes.
5. **Driver de Prisma.** Como el entorno no pudo descargar el motor en Rust de Prisma, el cliente usa el modo sin motor (`engineType = "client"` con el adaptador `pg`). Funciona en cualquier máquina, pero lo probaría con la configuración de producción de ustedes antes de adoptarlo.

---

## Cómo correrlo

Necesita Node 20 o superior, y PostgreSQL con Docker o sin él.

```bash
# 1. Base de datos: elige UNA opción
docker compose up -d db              # Postgres 16 en :54329, crea el rol de solo lectura
#   o, sin Docker:
cd api && npm install && npm run db:embedded     # déjalo corriendo; migra y carga los datos solo

# 2. API  (otra terminal)
cd api
cp .env.example .env                 # cambia los secretos si quieres
npm install
npm run db:generate
npm run db:migrate && npm run db:seed    # solo con Docker; la opción embebida ya lo hizo
npm run build && npm run start       # http://localhost:4000

# 3. Web  (otra terminal)
cd web
cp .env.example .env.local
npm install && npm run dev           # http://localhost:3000
```

Abre http://localhost:3000 y elige una identidad. El dataset no trae contraseñas, así que esa pantalla hace las veces del inicio de sesión propio de cada broker (solo para desarrollo, está explicado en SECURITY).

| Entra como | Qué vas a ver |
| --- | --- |
| **T-005** (Summit) | dos cuentas; ACC-1006 está en **94% de riesgo**, o sea el estado de alto riesgo |
| **T-011** (Meridian) | sin actividad de trading: estado vacío |
| **T-010** (Meridian) | saldo en cero con una posición abierta: riesgo 100, sin dividir por cero |
| **T-001** (Retail) | otro tenant, con sus propios datos |

**Para simular un fill en vivo** con la página abierta (opción 1 de `simulate-fills.md`):

```bash
curl -X POST localhost:4000/dev/fills \
  -H 'content-type: application/json' -H 'x-dev-key: <DEV_API_KEY de tu .env>' \
  -d '{"account_id":"ACC-1006","instrument_symbol":"MES","side":"BUY","quantity":2,"price":5643.25,"commission_usd":1.40}'
```

Si después apagas el API, en unos 15 segundos la página marca todas las cifras como **STALE** (desactualizadas). Al volver a encenderlo, se reconecta y se pone al día.

**Pruebas**

```bash
cd api && npm run test:unit   # 31 pruebas, ~2 s, sin base de datos
cd api && npm run test:e2e    # 65 pruebas contra un PostgreSQL real (embebido; lo levantan las propias pruebas)
cd web && npm test            # lógica pura del cliente
```

`npm run test:e2e` es, en la práctica, la especificación del modelo de seguridad: acceso entre tenants y entre traders, tokens falsificados, aislamiento del WebSocket, comportamiento de la RLS y la exactitud de las 18 cuentas contra el oráculo en Python.

---

## Cómo está construido

```
Navegador (Next.js)                       API (NestJS, hexagonal)                      PostgreSQL
───────────────────                       ───────────────────────                      ──────────
REST  GET /v1/me/snapshot ──Bearer JWT──▶ JwtAuthGuard ─▶ TenantScope{broker,trader}
                                          SnapshotController                           rol arrowfin_app:
WS    socket.io (auth:{token}) ─handshake─▶ FillsGateway.use(verifica JWT,             solo SELECT, RLS activa,
       no existen mensajes de entrada       une a salas elegidas por el servidor)      NOBYPASSRLS
                                          GetSnapshotUseCase                           set_config('app.broker_id')
                                            ├─ SnapshotRepositoryPort ─▶ PrismaSnapshotRepository ─▶ withTenant(tx)
                                            └─ computeSnapshot()   ← función pura, sin I/O
POST /dev/fills (solo dev) ─▶ DevFillsService ─▶ inserta (conexión privilegiada) ─▶ recalcula ─▶ publica en la sala
```

La carpeta `snapshot/domain` contiene `computeSnapshot()`, una función pura: recibe fills, instrumentos, marcas, saldo e inicio de sesión, y devuelve posiciones, P&L y riesgo. Tanto el REST como el WebSocket pasan por ella, así que nunca pueden contradecirse. Ahí viven las reglas financieras y la mayoría de las pruebas unitarias. En `snapshot/application` están el caso de uso y los puertos (`SnapshotRepositoryPort`, `SnapshotPublisherPort`, `Clock`). En `snapshot/infrastructure` está el adaptador de Prisma, donde todo método recibe un `TenantScope`, de modo que olvidar el tenant ni siquiera compila. `realtime` tiene el gateway de Socket.IO y `dev` el simulador y el login de demostración, que solo se cargan en desarrollo.

### Tarea 1: datos e índice

La tabla `fills` lleva un `broker_id` desnormalizado y **claves foráneas compuestas** `(account_id, broker_id) → accounts(id, broker_id)`. Eso trae dos beneficios: la política de RLS queda en una comparación simple, `broker_id = current_setting(...)`, sin joins, y la propia base de datos rechaza un fill que apunte a la cuenta de otro broker (está probado).

**El índice que puedo explicar** es `fills(account_id, filled_at, id)`. La consulta caliente es "todos los fills de una cuenta, en orden de tiempo": igualdad sobre `account_id` y después `filled_at, id` ya ordenados, así que Postgres hace un recorrido por rango del índice sin paso de ordenamiento. `broker_id` no está en el índice a propósito: `account_id` ya es muy selectivo y la RLS añade `broker_id` como un filtro barato sobre las pocas filas que quedan. Ponerlo primero solo ayudaría a consultas que ningún endpoint ejecuta, y por eso lo dejé fuera (lo razoné, no lo medí con un benchmark).

Hay varias reglas financieras fáciles de equivocar, y cada una tiene su prueba:

- **Tamaño del contrato.** El valor es precio × cantidad × `point_value_usd` (MES 5, ES 50, 6E 125.000). Todo el dinero se maneja con `decimal.js`.
- **Una sesión no es un día calendario.** El CME abre a las 17:00 hora central de EE. UU. El "hoy" del corte del dataset es la sesión que empezó el 24-ago-2026 a las 17:00 CDT (22:00 UTC). Se calcula en `America/Chicago`, así que el cambio de hora queda bien, y los fines de semana retroceden a la sesión del jueves. Los festivos del exchange no están modelados.
- **Las posiciones se arrastran.** Las posiciones abiertas salen de todos los fills; el P&L del día, solo de los fills de la sesión actual.
- **Comisiones y órdenes parciales.** Las comisiones se restan del P&L realizado, y varios fills con el mismo `order_id` cuentan como una sola orden.
- **No realizado.** Es el P&L abierto contra el precio promedio de entrada, porque el dataset no trae el precio de liquidación de la sesión anterior.
- **Riesgo.** `min(100, nocional bruto / saldo × 100)`. Un saldo cero o negativo con exposición da 100, y sin exposición da 0. Nunca aparece NaN ni Infinity.
- **No todas las cuentas están activas.** Las cuentas cerradas y restringidas se pueden consultar y lo indican, y una cuenta sin fills devuelve un snapshot vacío pero válido.

### Tarea 2: qué pasa cuando el socket se cae

La pregunta del enunciado es cómo sabe el cliente que perdió fills mientras estuvo desconectado, y qué hace al respecto. Mi respuesta es que **no intenta saberlo**: cada evento que llega por el socket es el **snapshot completo** más una `version` por cuenta (la cantidad de fills aplicados). Como son estados y no diferencias, un evento duplicado o tardío trae una versión igual o menor a la que se muestra y se ignora; y un evento más nuevo después de un hueco se aplica directamente, porque ya contiene todo lo que habrían aportado los eventos perdidos. Un hueco se cura solo.

Además, **en cada conexión, incluida la primera, el cliente vuelve a pedir el snapshot por REST**. Eso cubre el caso en que después de la caída no llegue ningún evento más (el mercado se calma justo ahí) y también la carrera de la primera conexión, donde un fill puede caer entre la respuesta REST y el momento en que el socket entra a su sala.

Mientras el socket no esté conectado, **nada se presenta como si fuera en vivo**: el indicador de conexión cambia, aparece un banner **STALE** con la hora de la última actualización en vivo, y todas las cifras se atenúan y se marcan como STALE. Socket.IO envía un ping cada 10 s con 5 s de tolerancia, por lo que una conexión que muere en silencio se detecta en unos 15 s, no "en algún momento". Las reconexiones usan retroceso exponencial con jitter (de 1 s a 15 s, ±50%) para que una caída del feed no se convierta en una avalancha de clientes cuando vuelva. Y como el servidor cierra el socket cuando vence el JWT, el cliente renueva su token 60 s antes de que expire y, si aun así lo rechazan, renueva y se reconecta.

Lo probé en un navegador: apagué el API y la página pasó a STALE; mientras estaba caído inserté un fill directamente en la base; al reiniciar el API, la página volvió a estar en vivo **con el fill que ocurrió durante la caída**.

Y la salvedad honesta, porque el enunciado pregunta si la implementación podría mostrar cifras viejas sin avisar: entre que una conexión muere y Socket.IO se da cuenta (hasta unos 15 s) la página todavía dice "Live". Para acotarlo más haría falta un latido propio de la aplicación con una marca de frescura enviada por el servidor, y no lo construí.

### Lo que recorté, y por qué

Recalcular desde todo el historial de fills en cada evento funciona con este dataset, pero cuesta O(fills de esa cuenta) por evento y no sobreviviría a volúmenes de producción (lo retomo en la Tarea 5). Tampoco incluí el adaptador de Redis para Socket.IO: hoy hay una sola instancia del API, y con dos, un fill publicado en una no llegaría a los sockets de la otra; conozco la solución (el adaptador más los mismos nombres de sala), pero no la construí. No hay un proveedor de identidad real, porque el dataset no trae credenciales, así que existe un login de desarrollo y la renovación del token hace de reemplazo de un flujo con refresh token. El rate limiting, el log de auditoría y la redacción estructurada de logs están descritos con detalle en la sección 5 de SECURITY. Finalmente, las pruebas del frontend se limitan a la lógica pura; el comportamiento lo revisé a mano en un navegador real, sin pruebas de interfaz versionadas.

---

## Tarea 5: arquitectura y traspaso

**La decisión de la que estoy más orgulloso, y lo que costó.** Hice que el aislamiento entre tenants fuera estructural y no una cuestión de disciplina. El tenant existe en un solo lugar, el token verificado; cada método de repositorio lo exige en su firma; las consultas lo repiten en el `WHERE`; y la base de datos, por su cuenta, se niega a devolver filas de otro tenant (row level security que falla cerrado, un rol de aplicación de solo lectura y llaves foráneas compuestas). Para que un fill llegue al tenant equivocado tendrían que fallar tres cosas a la vez, y cada capa tiene su propia prueba. El costo: un viaje extra a la base de datos por petición para fijar el tenant, `broker_id` duplicado en varias tablas, un segundo rol de base de datos para el entorno local y pruebas que necesitan un PostgreSQL real. Tampoco es total: RLS aísla por tenant, así que la separación entre dos traders del mismo broker sigue dependiendo del `WHERE`. La rompí a propósito y una prueba lo detectó, pero es una garantía más débil y prefiero decirlo.

**Lo único que cambiaría con un segundo día.** Dejar de recalcular el snapshot desde todo el historial de fills en cada evento. Mantendría una tabla `positions` por cuenta, actualizada en la misma transacción que guarda el fill, y armaría el snapshot con ella y los precios de mercado. El costo por fill pasa a ser constante, el `version` tiene un lugar natural y la ingesta podría separarse después en otro servicio. Justo después: el adaptador de Redis para Socket.IO y mover el token de `sessionStorage` a una cookie httpOnly detrás de un BFF pequeño.

**Si entregara este repositorio a dos ingenieros mañana.** Primero les pediría ejecutar `npm run test:e2e`: las pruebas son la especificación del modelo de seguridad, y `SECURITY.es.md` explica por qué existe cada regla. Les pediría no cambiar cinco cosas sin una discusión por escrito: (1) un `TenantScope` solo se crea desde un token verificado, nunca desde un parámetro, body o header; (2) los datos del tenant solo se leen con `withTenant`, y el rol de base de datos de la aplicación sigue siendo de solo lectura, sin ser dueño y sin `BYPASSRLS`; (3) toda tabla nueva con `broker_id` llega con su política RLS en el mismo PR (una prueba guardián lo exige); (4) el gateway de WebSocket sigue sin manejadores de mensajes entrantes ni salas elegidas por el cliente; (5) las respuestas de la API son listas de campos permitidos y los payloads nunca se registran. Todo lo demás, desde la interfaz hasta el método del P&L, es de ellos para mejorar, y les pediría revisar los pull requests del otro con una sola pregunta: "¿quién está pidiendo esto y cómo lo sabemos?"

# Revisión de código (Tarea 4, versión en español)

*Escrita como la dejaría en el pull request.*

```ts
@Get('positions/:accountId')
async getPositions(@Param('accountId') accountId: string, @Req() req) {
  const positions = await this.prisma.position.findMany({ where: { accountId } });
  this.logger.log(`positions for ${accountId}: ${JSON.stringify(positions)}`);
  return positions.map(p => ({ ...p, pnl: (p.markPrice - p.avgPrice) * p.qty }));
}
```

---

**Veredicto: pido cambios. No lo mergearía, y no lo desplegaría ni siquiera detrás de un flag hasta arreglar el primer punto.**

Gracias por el PR. El endpoint se lee fácil y la forma (buscar, mapear, devolver) es un buen punto de partida. Pero hay tres cosas que pueden filtrar datos de clientes y deben cambiar antes de salir. Las arreglaría juntas y con gusto lo hacemos en pareja. Ninguna es cuestión de estilo.

### Bloquean: hay que cambiarlas antes del merge

**1. Cualquier usuario con sesión puede leer las posiciones de cualquier persona (IDOR / autorización rota a nivel de objeto). Este es el primero que arreglaría.**
El `accountId` viene de la URL y va directo a la consulta. Nada comprueba que la cuenta le pertenezca a quien llama: `req` se inyecta y nunca se usa, así que la identidad del usuario se ignora. Los ids de cuenta parecen consecutivos (`ACC-1001`, `ACC-1002`…), por lo que un trader de cualquier broker puede recorrerlos y leer las posiciones de todos los demás tenants. Nuestra propia regla dice que el acceso entre tenants es un P0, y esto es exactamente eso. Un guard de autenticación a nivel de clase solo demostraría que "alguien inició sesión", no que "esta persona puede ver esta cuenta".
*Cómo arreglarlo:* tomar el tenant y el trader del token verificado, nunca de la petición; consultar con `where: { accountId, account: { brokerId, traderId } }` dentro de nuestro helper `withTenant()` para que además aplique la RLS; devolver el mismo `404` para "no es tuya" y "no existe", así no se pueden enumerar ids; y validar el parámetro (`^ACC-\d+$`). **Agregar una prueba donde un trader del broker A pide una cuenta del broker B y recibe 404**, y otra con un trader distinto del mismo broker. Esa prueba es el verdadero entregable de este arreglo.

**2. Escribe las posiciones financieras de los clientes en los logs.**
`JSON.stringify(positions)` en nivel `log` pone datos regulados en el almacenamiento de logs, que tiene controles de acceso distintos a los de la base, más retención y más gente que lo lee. Además, `${accountId}` es texto controlado por el usuario entrando a una línea de log, de modo que un valor con salto de línea puede falsificar entradas (inyección en logs). Si esto ya corrió en algún sitio con datos reales, hay que tratarlo como una posible exposición de datos y preguntarle a seguridad si es reportable.
*Cómo arreglarlo:* registrar identificadores, nunca payloads: el id de la petición, el id del trader y la cantidad de posiciones. Si alguien de verdad necesita ver el payload para depurar, eso es un cambio local y temporal que no se commitea.

**3. `...p` devuelve todas las columnas de la tabla.**
La respuesta es todo lo que tenga la tabla: ids internos, `brokerId` y cualquier columna que alguien agregue después, de forma automática y silenciosa. El contrato de la API debería ser una lista explícita de campos.
*Cómo arreglarlo:* un DTO de respuesta con campos explícitos (y un `select` de Prisma, para que las columnas innecesarias ni siquiera se lean).

### Arreglar antes de que alimente algo que vea un cliente (acepto un ticket de seguimiento solo si el campo queda oculto mientras tanto)

**4. El número del P&L parece correcto y está mal.** `(markPrice - avgPrice) * qty` ignora el multiplicador del contrato: para un mismo movimiento de un punto, una posición de `ES` vale 10 veces la de `MES`, y `6E` son 125.000 por unidad. También ignora las comisiones y usa flotantes binarios para dinero. Va a estar equivocado por un factor de 5 a 50 según el instrumento y sin ningún error que avise, que es la peor clase de bug en un producto de trading. Además, un `markPrice` leído de una fila guardada puede estar desactualizado. *Cómo arreglarlo:* reutilizar el calculador de snapshot que ya existe (función pura, probada contra una implementación independiente) en lugar de recalcular dentro de un controlador.

### Comentarios: no bloquean, pero me gustaría verlos

- **Capas.** El controlador habla directo con Prisma. Yo pondría la consulta detrás de un repositorio o puerto y las cuentas en la función de dominio, de modo que el controlador solo traduzca HTTP a un caso de uso. Además facilita escribir la prueba que falta.
- **Consulta sin límite.** `findMany` sin tope ni paginación: una cuenta con mucho historial devuelve todo.
- **Tipos.** `@Req() req` es `any`. Un decorador `@CurrentScope()` entrega un alcance de tenant tipado y no falsificable, y hace difícil repetir el punto 1.
- **Sin pruebas.** No aprobaría ningún endpoint que devuelva datos de clientes sin, al menos, la prueba entre tenants.
- **Lista vacía vs. 404.** Devolver `[]` para una cuenta que no existe no es peligroso, pero hay que mantenerlo coherente con la regla del 404 del punto 1.

### Lo que haría primero

**El punto 1, hoy, y solo.** Es explotable ahora mismo por cualquier usuario autenticado, cruza tenants y el arreglo es pequeño. Si este endpoint ya está en vivo, sacaría el punto 1 (y quitaría la línea de log del punto 2) como un hotfix antes que cualquier otra cosa de este PR, y después haría bien el 3 y el 4. Lo demás puede esperar a la siguiente revisión.

### Cómo se lo diría a quien lo escribió

Dejaría el comentario de arriba y después le escribiría directamente: *"Los dos primeros son clásicos y es muy fácil pasarlos por alto, porque el código funciona perfecto en el camino feliz. ¿Te animas a que dediquemos diez minutos juntos, escribimos primero la prueba entre tenants y la vemos fallar con el código actual?"* La meta es que la próxima vez se pregunte "¿quién llama a esto y cómo lo sé?" antes de escribir la consulta, no que se sienta evaluado.

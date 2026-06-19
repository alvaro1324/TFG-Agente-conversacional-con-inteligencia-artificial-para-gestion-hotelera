# AI Conversational Agent Dashboard

Frontend en Angular para monitorizar conversaciones entre cliente, sistema y agente IA, visualizar entidades capturadas y consultar el payload raw asociado a cada mensaje.

El proyecto soporta dos modos de trabajo:

- `mock`, para demo visual y validación de interfaz sin backend.
- `live`, alimentado por websocket y polling HTTP contra el backend.

## Qué incluye

- Vista principal de conversación en formato chat.
- Auto-scroll al último mensaje cuando entra actividad nueva.
- Mensajes de sistema para inicio y fin de llamada.
- Saludo inicial del agente al comenzar la llamada.
- Panel lateral con intenciones y entidades capturadas.
- Filtro automático para ocultar en la sidebar los campos `null`, `undefined` o vacíos.
- Drawer de detalle raw por mensaje tanto en modo mock como en live.
- Filtros temporales para números de cliente y servicio.
- Tema claro/oscuro.
- Exportación de documentación TSDoc con TypeDoc.

## Stack

- Angular 19
- TypeScript
- SCSS
- Standalone components
- `HttpClient`
- `socket.io-client`
- TypeDoc

## Requisitos

- Node.js 20 o superior
- npm

Angular 19 recomienda `Node.js 20.11.1` o superior dentro de la rama 20.

## Instalación

```bash
npm install
```

## Scripts

```bash
npm start
npm run build
npm run watch
npm test
npm run docs
npm run docs:json
```

## Uso

### Desarrollo

```bash
npm start
```

La aplicación queda disponible en `http://localhost:4200/`.

`npm start` arranca `ng serve` con `proxy.conf.json`.

<!-- REDACTADO: aqui se explicaba la URL real del backend y el mecanismo interno de redireccion. Se ha retirado para no exponer infraestructura ni nombres de rutas corporativas. -->

### Build

```bash
npm run build
```

La salida se genera en `dist/`.

### Tests

```bash
npm test
```

### Documentación TSDoc

```bash
npm run docs
```

Genera la documentación HTML en `dist/tsdoc/`.

```bash
npm run docs:json
```

Genera además la exportación JSON en `dist/tsdoc/typedoc-data.json`.

## Configuración de entorno

Archivos:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`

Variables destacadas:

- `conversationEndpoint`: endpoint HTTP de histórico / conversación agregada.
- `capturedEntitiesEndpoint`: endpoint HTTP de entidades capturadas.
- `login`: endpoint usado para obtener credenciales del websocket.
- `showMock`: activa o desactiva las acciones manuales de mock en la cabecera.
- `capturedEntitiesPollingIntervalMs`: intervalo de polling de entidades capturadas en modo live.

En desarrollo:

- `conversationEndpoint` usa `/api/conversation-info`
- `capturedEntitiesEndpoint` usa `/api/captured-info`
- `login` queda vacio en la version entregable

En producción:

- los endpoints estan redactados en la version entregable
- no se incluye informacion de infraestructura real

<!-- REDACTADO: en el proyecto interno aqui irian las URLs reales de conversacion, entidades y autenticacion websocket. -->

## Proxy de desarrollo

El archivo `proxy.conf.json` define dos rutas:

- `/api/conversation-info`
- `/api/captured-info`

Cada una reescribe hacia rutas anonimizadas de ejemplo.

<!-- REDACTADO: aqui iria el path real y los parametros internos esperados por el backend. -->

Si se modifica el proxy, es necesario reiniciar `ng serve`.

## Flujo live actual

`LiveConversationService` centraliza la conversación en vivo.

Cuando llega un `ivr init` válido:

1. se abre la sesión live
2. se limpia la conversación anterior
3. se pinta un mensaje de sistema: `Iniciando la llamada`
4. se pinta el saludo inicial del agente
5. arranca el polling de entidades capturadas

Cuando llega un `ivr end` válido:

1. se detiene el polling
2. se añade el mensaje `Fin de llamada`
3. la vista vuelve a estado inactivo

Cada evento `ai_agent` genera mensajes visibles y también un `RawConversationDetail` enlazado por el `messageId` local que usa la UI.

## Intenciones capturadas

La barra lateral ya no depende solo del mock.

En modo live:

- el endpoint de entidades capturadas se consulta de forma periódica
- la respuesta se transforma en tarjetas visibles
- los campos `null`, `undefined` o vacíos no se muestran
- `capture_field: none` también se oculta

Ejemplo: si el backend devuelve solo `intent`, `capture_ok`, `confirm`, `end` y `reset`, solo esos campos aparecerán en la sidebar.

## Payload raw por mensaje

El drawer raw funciona en ambos modos:

- `mock`: usa los payloads definidos en `dashboard.mock.ts`
- `live`: genera un `messageId` local por mensaje renderizado y asocia ahí el payload recibido

Esto evita depender de un `id` del backend para abrir el detalle técnico de un mensaje live.

## Estructura principal

```text
src/
  app/
    components/
      conversation-panel/
      intents-sidebar/
      layout-footer/
      layout-header/
    data/
      dashboard.mock.ts
    models/
      api.models.ts
      conversation.models.ts
    services/
      api-endpoints.ts
      app-init.provider.ts
      app-init.service.ts
      captured-entities-api.service.ts
      conversation-api.service.ts
      live-conversation.service.ts
      realtime-socket.service.ts
      ws-auth.service.ts
    app.component.*
    app.config.ts
  environments/
proxy.conf.json
```

## Arquitectura funcional

### UI

- `app.component`: compone el dashboard y resuelve conversación, intents y drawer raw desde el servicio live.
- `conversation-panel`: renderiza conversación, estados, drawer raw y auto-scroll.
- `intents-sidebar`: muestra entidades e intenciones capturadas.
- `layout-header`: agrupa acciones de tema, mock y filtros temporales.
- `layout-footer`: pie informativo del dashboard.

### Datos mock

`src/app/data/dashboard.mock.ts` contiene conversación de ejemplo, payloads raw y entidades precargadas para iterar visualmente sin depender del backend.

### Integración REST

Servicios disponibles:

- `ConversationApiService`
- `CapturedEntitiesApiService`
- `WsAuthService`

Contrato actual relevante:

- `CapturedEntitiesApiService` realiza `POST` y envía `confid` en el body.
- `WsAuthService` mantiene login contra `environment.login`, que queda vacio en esta entrega.

<!-- REDACTADO: aqui iria la descripcion del endpoint real de autenticacion websocket y su payload corporativo. -->

### Integración en tiempo real

La aplicación inicializa el websocket al arrancar mediante:

- `AppInitService`
- `provideWsAppInit()`
- `RealtimeSocketService`

`LiveConversationService` transforma los eventos `ivr` y `ai_agent` en:

- mensajes visibles
- detalles raw asociados a cada mensaje
- intenciones capturadas para la sidebar

## Notas

- La carpeta `dist/tsdoc/` está pensada como salida generada y no se versiona.
- Si cambian los parametros del backend real, habra que actualizar `proxy.conf.json` y `environment.ts` en la copia privada.
- Si el backend devuelve nuevos campos de captura, habrá que mapearlos en `LiveConversationService`.

## Referencia Angular

```bash
npx ng help
```

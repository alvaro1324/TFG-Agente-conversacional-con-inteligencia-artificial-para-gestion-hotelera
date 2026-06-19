/**
 * Variables de entorno para compilación de producción.
 */
export const environment = {
  production: true,
  // REDACTADO: aqui iria la URL completa del endpoint productivo de historico de conversacion.
  conversationEndpoint: '',
  // REDACTADO: aqui iria la URL completa del endpoint productivo de entidades capturadas.
  capturedEntitiesEndpoint: '',
  // REDACTADO: aqui iria la URL del servicio de autenticacion websocket.
  login: '',
  showMock: true,
  capturedEntitiesPollingIntervalMs: 1000,
} as const;

/**
 * Variables de entorno para compilación de desarrollo.
 */
export const environment = {
  production: false,
  conversationEndpoint: '/api/conversation-info',
  capturedEntitiesEndpoint: '/api/captured-info',
  // REDACTADO: aqui iria la URL del servicio de autenticacion websocket usada en desarrollo.
  login: '',
  showMock: true,
  capturedEntitiesPollingIntervalMs: 1000,
} as const;

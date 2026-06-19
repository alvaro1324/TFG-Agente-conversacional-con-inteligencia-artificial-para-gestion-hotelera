import { environment } from '../../environments/environment';

/**
 * Endpoints HTTP consumidos por la capa de servicios de la aplicación.
 */
export const API_ENDPOINTS = {
  conversation: environment.conversationEndpoint,
  capturedEntities: environment.capturedEntitiesEndpoint,
} as const;

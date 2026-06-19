/**
 * Roles visuales admitidos en la conversación renderizada.
 */
export type MessageRole = 'user' | 'assistant' | 'system';
export type SystemMessageVariant = 'default' | 'action' | 'call';

/**
 * Modos de tema disponibles para la interfaz.
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Estados visuales de una intención capturada.
 */
export type IntentStatus = 'confirmed' | 'detected' | 'pending';

/**
 * Mensaje listo para ser representado en el panel de conversación.
 */
export interface ConversationMessage {
  id: number;
  author: string;
  role: MessageRole;
  time: string;
  text: string;
  systemVariant?: SystemMessageVariant;
}

/**
 * Intención o dato capturado que se muestra en la barra lateral.
 */
export interface CapturedIntent {
  title: string;
  detail: string;
  status: IntentStatus;
}

/**
 * Payload crudo asociado a un mensaje concreto de la conversación.
 */
export interface RawConversationDetail {
  messageId: number;
  source: string;
  eventName: string;
  intent: string;
  confidence: string;
  payload: string;
}

/**
 * Elemento resumido para una línea temporal de eventos.
 */
export interface TimelineSummaryItem {
  time: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning';
}

/**
 * Intenciones de negocio esperadas para la conversación hotelera.
 */
export type ConversationIntent = 'new_booking' | 'my_bookings' | 'unknown';

/**
 * Respuesta ternaria usada por el agente cuando todavía no hay confirmación
 * concluyente.
 */
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

/**
 * Respuesta binaria confirmada.
 */
export type YesNo = 'yes' | 'no';

/**
 * Campo actualmente en captura dentro del flujo de reserva.
 */
export type CaptureField =
  | 'nombre'
  | 'telefono'
  | 'dni'
  | 'cp'
  | 'fecha_entrada'
  | 'fecha_salida'
  | 'noches'
  | 'personas'
  | 'none';

/**
 * Estructura agregada de entidades e intención capturadas por el agente.
 */
export interface CapturePayload {
  intent: ConversationIntent;
  nombre: string | null;
  telefono: string | null;
  dni: string | null;
  cp: string | null;
  fecha_entrada: string | null;
  fecha_salida: string | null;
  noches: number | null;
  personas: number | null;
  confirm: YesNoUnknown;
  opcion: number | null;
  capture_ok: YesNoUnknown;
  capture_field: CaptureField;
  end: YesNo;
  reset: YesNo;
}

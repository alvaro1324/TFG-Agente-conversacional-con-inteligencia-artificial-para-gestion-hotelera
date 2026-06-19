import {
  CapturePayload,
  CapturedIntent,
  ConversationMessage,
  RawConversationDetail,
} from '../models/conversation.models';

/**
 * Número de cliente usado por defecto en la demo del dashboard.
 *
 * REDACTADO: el numero real usado durante pruebas internas fue sustituido por
 * un numero sintetico no enrutable.
 */
export const CUSTOMER_PHONE = '34600000000';
/**
 * Nombre del servicio o agente mostrado en la demo.
 *
 * REDACTADO: aqui iria el nombre real del servicio/agente usado en la empresa.
 */
export const SERVICE_NAME = 'Agente IA Demo';

/**
 * Payload agregado de entidades e intención capturadas durante la conversación.
 *
 * REDACTADO: todos los datos personales de ejemplo se han sustituido por datos
 * sinteticos para que no parezcan trazas reales.
 */
export const CAPTURE_PAYLOAD: CapturePayload = {
  intent: 'new_booking',
  nombre: 'Cliente Demo',
  telefono: '600000000',
  dni: '00000000T',
  cp: '00000',
  fecha_entrada: '2025-04-16',
  fecha_salida: '2025-04-17',
  noches: 1,
  personas: 2,
  confirm: 'yes',
  opcion: null,
  capture_ok: 'yes',
  capture_field: 'nombre',
  end: 'yes',
  reset: 'no',
};

/**
 * Conversación base usada como mock inicial del dashboard.
 */
export const CONVERSATION_MESSAGES: ConversationMessage[] = [
  {
    id: 1,
    author: 'Cliente',
    role: 'user',
    time: '09:59',
    text: 'Hola, muy buenas. Mira, quiero hacer una nueva reserva.',
  },
  {
    id: 2,
    author: 'Agente IA',
    role: 'assistant',
    time: '09:59',
    text: '¿Podría indicarme su número de teléfono para continuar?',
  },
  {
    id: 3,
    author: 'Cliente',
    role: 'user',
    time: '09:59',
    text: 'Claro, mi número de teléfono es el seis cero cero cero cero cero cero cero cero.',
  },
  {
    id: 4,
    author: 'Sistema',
    role: 'system',
    time: '09:59',
    text: 'AGENT_TIMEOUT_RETRY',
  },
  {
    id: 5,
    author: 'Cliente',
    role: 'user',
    time: '09:59',
    text: 'Mi número de teléfono es el seis cero cero cero cero cero cero cero cero.',
  },
  {
    id: 6,
    author: 'Agente IA',
    role: 'assistant',
    time: '09:59',
    text: 'Por favor, deme su DNI completo con la letra.',
  },
  {
    id: 7,
    author: 'Cliente',
    role: 'user',
    time: '10:00',
    text: 'Claro, mira, mi DNI es el cero cero, cero cero, cero cero, cero cero, t.',
  },
  {
    id: 8,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:00',
    text: '¿Para qué fecha desea realizar su entrada?',
  },
  {
    id: 9,
    author: 'Cliente',
    role: 'user',
    time: '10:00',
    text: 'Quiero entrar mañana.',
  },
  {
    id: 10,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:00',
    text: '¿Para qué fecha desea realizar su salida?',
  },
  {
    id: 11,
    author: 'Cliente',
    role: 'user',
    time: '10:00',
    text: 'Quiero estar solamente tres noches.',
  },
  {
    id: 12,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:00',
    text: '¿Cuántas personas se alojarán?',
  },
  {
    id: 13,
    author: 'Cliente',
    role: 'user',
    time: '10:00',
    text: 'Vamos a ir mi mujer, mi hijo y yo.',
  },
  {
    id: 14,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:00',
    text: 'Tenemos una habitación triple disponible para esas fechas. ¿Desea confirmar su reserva?',
  },
  {
    id: 15,
    author: 'Sistema',
    role: 'system',
    time: '10:01',
    text: 'NOINPUT_RETRY',
  },
  {
    id: 16,
    author: 'Cliente',
    role: 'user',
    time: '10:01',
    text: 'Sí, quiero confirmar la',
  },
  {
    id: 17,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:01',
    text: 'Su reserva ha sido confirmada. ¿Desea realizar alguna otra gestión?',
  },
  {
    id: 18,
    author: 'Cliente',
    role: 'user',
    time: '10:01',
    text: 'No, quiero colgar la llamada.',
  },
  {
    id: 19,
    author: 'Sistema',
    role: 'system',
    time: '10:01',
    text: 'ACTION: colgar',
  },
  {
    id: 20,
    author: 'Agente IA',
    role: 'assistant',
    time: '10:01',
    text: 'Gracias por llamar al servicio de reservas demo. ¡Hasta pronto!',
  },
];

/**
 * Calcula el estado visual de un campo capturado a partir de su valor.
 *
 * @param value Valor actual del campo.
 * @returns Estado simplificado para la UI.
 */
const fieldStatus = (value: string | number | null): 'confirmed' | 'pending' =>
  value === null || value === '' ? 'pending' : 'confirmed';

/**
 * Intenciones y entidades derivadas del payload agregado.
 */
export const CAPTURED_INTENTS_FROM_PAYLOAD: CapturedIntent[] = [
  {
    title: 'Intent',
    detail: CAPTURE_PAYLOAD.intent,
    status: 'detected',
  },
  {
    title: 'Nombre',
    detail: CAPTURE_PAYLOAD.nombre ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.nombre),
  },
  {
    title: 'Teléfono',
    detail: CAPTURE_PAYLOAD.telefono ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.telefono),
  },
  {
    title: 'DNI',
    detail: CAPTURE_PAYLOAD.dni ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.dni),
  },
  {
    title: 'Código postal',
    detail: CAPTURE_PAYLOAD.cp ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.cp),
  },
  {
    title: 'Fecha de entrada',
    detail: CAPTURE_PAYLOAD.fecha_entrada ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.fecha_entrada),
  },
  {
    title: 'Fecha de salida',
    detail: CAPTURE_PAYLOAD.fecha_salida ?? 'null',
    status: fieldStatus(CAPTURE_PAYLOAD.fecha_salida),
  },
  {
    title: 'Noches',
    detail: CAPTURE_PAYLOAD.noches === null ? 'null' : String(CAPTURE_PAYLOAD.noches),
    status: fieldStatus(CAPTURE_PAYLOAD.noches),
  },
  {
    title: 'Personas',
    detail: CAPTURE_PAYLOAD.personas === null ? 'null' : String(CAPTURE_PAYLOAD.personas),
    status: fieldStatus(CAPTURE_PAYLOAD.personas),
  },
  {
    title: 'Confirm',
    detail: CAPTURE_PAYLOAD.confirm,
    status:
      CAPTURE_PAYLOAD.confirm === 'yes'
        ? 'confirmed'
        : CAPTURE_PAYLOAD.confirm === 'unknown'
          ? 'detected'
          : 'pending',
  },
  {
    title: 'Opción',
    detail: CAPTURE_PAYLOAD.opcion === null ? 'null' : String(CAPTURE_PAYLOAD.opcion),
    status: fieldStatus(CAPTURE_PAYLOAD.opcion),
  },
  {
    title: 'Capture OK',
    detail: CAPTURE_PAYLOAD.capture_ok,
    status:
      CAPTURE_PAYLOAD.capture_ok === 'yes'
        ? 'confirmed'
        : CAPTURE_PAYLOAD.capture_ok === 'unknown'
          ? 'detected'
          : 'pending',
  },
  {
    title: 'Capture field',
    detail: CAPTURE_PAYLOAD.capture_field,
    status: CAPTURE_PAYLOAD.capture_field === 'none' ? 'pending' : 'detected',
  },
  {
    title: 'End',
    detail: CAPTURE_PAYLOAD.end,
    status: CAPTURE_PAYLOAD.end === 'yes' ? 'confirmed' : 'pending',
  },
  {
    title: 'Reset',
    detail: CAPTURE_PAYLOAD.reset,
    status: CAPTURE_PAYLOAD.reset === 'yes' ? 'detected' : 'confirmed',
  },
];

/**
 * Payloads crudos asociados a cada mensaje del mock de conversación.
 *
 * REDACTADO: los payloads ya no contienen identificadores, numeros de telefono,
 * nombres comerciales ni codigos de nodo reales. Aqui iria una traza anonimizada
 * equivalente a la devuelta por el backend.
 */
export const RAW_DETAILS: RawConversationDetail[] = [
  {
    messageId: 1,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'new_booking_request',
    confidence: '1.00 confidence',
    payload: `{
  "id": 713,
  "node_id": 1,
  "node_name": "prueba de agente",
  "service_number": "910000000",
  "service_name": "Agente IA Demo",
  "ani": "600000000",
  "confid": "CONFID_REDACTED_EXAMPLE",
  "interaction_count": 1,
  "transcription_result": "MATCH",
  "transcription_timestamp": "2026-04-10 09:59:16.930",
  "speaker": "customer",
  "channel": "voice",
  "text": "Hola, muy buenas. Mira, quiero hacer una nueva reserva.",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 2,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'collect_phone_number',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 1,
  "agent_request_timestamp": "2026-04-10 09:59:16.930",
  "agent_result": "OK",
  "agent_response": "¿Podría indicarme su número de teléfono para continuar?",
  "agent_process_time": 4,
  "result": "AGENT_OK_CONTINUE",
  "destination": 0
}`,
  },
  {
    messageId: 3,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'provide_phone_number',
    confidence: '1.00 confidence',
    payload: `{
  "id": 714,
  "interaction_count": 2,
  "transcription_result": "MATCH",
  "transcription_text": "Claro, mi número de teléfono es el seis cero cero cero cero cero cero cero cero.",
  "transcription_text_confidencelevel": 1.00,
  "attempt_status": "RETRY",
  "input_attempt": 1
}`,
  },
  {
    messageId: 4,
    source: 'agent.orchestrator',
    eventName: 'agent.timeout',
    intent: 'retry_after_timeout',
    confidence: 'agent_result=TIMEOUT',
    payload: `{
  "interaction_count": 2,
  "agent_request_timestamp": "2026-04-10 09:59:31.043",
  "agent_result": "TIMEOUT",
  "agent_error": "error.badfetch",
  "result": "AGENT_TIMEOUT_RETRY",
  "agent_process_time": 0
}`,
  },
  {
    messageId: 5,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'repeat_phone_number',
    confidence: '1.00 confidence',
    payload: `{
  "id": 715,
  "interaction_count": 3,
  "transcription_result": "MATCH",
  "transcription_text": "Mi número de teléfono es el seis cero cero cero cero cero cero cero cero.",
  "input_attempt": 2,
  "attempt_status": "RETRY",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 6,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'collect_dni',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 3,
  "agent_result": "OK",
  "agent_response": "Por favor, deme su DNI completo con la letra.",
  "agent_process_time": 5,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 7,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'provide_dni',
    confidence: '1.00 confidence',
    payload: `{
  "id": 716,
  "interaction_count": 4,
  "transcription_result": "MATCH",
  "transcription_text": "Claro, mira, mi DNI es el cero cero, cero cero, cero cero, cero cero, t.",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 8,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'ask_checkin_date',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 4,
  "agent_result": "OK",
  "agent_response": "¿Para qué fecha desea realizar su entrada?",
  "agent_process_time": 4,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 9,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'provide_checkin_date',
    confidence: '1.00 confidence',
    payload: `{
  "id": 717,
  "interaction_count": 5,
  "transcription_text": "Quiero entrar mañana.",
  "transcription_result": "MATCH",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 10,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'ask_checkout_date',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 5,
  "agent_result": "OK",
  "agent_response": "¿Para qué fecha desea realizar su salida?",
  "agent_process_time": 5,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 11,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'provide_stay_length',
    confidence: '1.00 confidence',
    payload: `{
  "id": 718,
  "interaction_count": 6,
  "transcription_text": "Quiero estar solamente tres noches.",
  "transcription_result": "MATCH",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 12,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'ask_guest_count',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 6,
  "agent_result": "OK",
  "agent_response": "¿Cuántas personas se alojarán?",
  "agent_process_time": 5,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 13,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'provide_guest_count',
    confidence: '1.00 confidence',
    payload: `{
  "id": 719,
  "interaction_count": 7,
  "transcription_text": "Vamos a ir mi mujer, mi hijo y yo.",
  "transcription_result": "MATCH",
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 14,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'offer_triple_room',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 7,
  "agent_result": "OK",
  "agent_response": "Tenemos una habitación triple disponible para esas fechas. ¿Desea confirmar su reserva?",
  "agent_process_time": 4,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 15,
    source: 'ivr.runtime',
    eventName: 'transcription.noinput',
    intent: 'retry_confirmation',
    confidence: '0.00 confidence',
    payload: `{
  "id": 720,
  "interaction_count": 8,
  "transcription_result": "NOINPUT",
  "transcription_text": "",
  "input_attempt": 1,
  "attempt_status": "RETRY",
  "result": "NOINPUT_RETRY"
}`,
  },
  {
    messageId: 16,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'confirm_booking',
    confidence: '1.00 confidence',
    payload: `{
  "id": 721,
  "interaction_count": 9,
  "transcription_text": "Sí, quiero confirmar la",
  "transcription_result": "MATCH",
  "input_attempt": 2,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 17,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'booking_confirmed',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 9,
  "agent_result": "OK",
  "agent_response": "Su reserva ha sido confirmada. ¿Desea realizar alguna otra gestión?",
  "agent_process_time": 3,
  "result": "AGENT_OK_CONTINUE"
}`,
  },
  {
    messageId: 18,
    source: 'customer.phone_call',
    eventName: 'message.received',
    intent: 'end_call',
    confidence: '1.00 confidence',
    payload: `{
  "id": 722,
  "interaction_count": 10,
  "transcription_text": "No, quiero colgar la llamada.",
  "transcription_result": "MATCH",
  "result": "AGENT_OK_ACTION"
}`,
  },
  {
    messageId: 19,
    source: 'agent.orchestrator',
    eventName: 'agent.action',
    intent: 'hangup',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 10,
  "agent_result": "OK",
  "agent_action": "colgar",
  "result": "AGENT_OK_ACTION",
  "destination": 0,
  "destination_name": "colgar"
}`,
  },
  {
    messageId: 20,
    source: 'agent.orchestrator',
    eventName: 'agent.response',
    intent: 'hangup',
    confidence: 'agent_result=OK',
    payload: `{
  "interaction_count": 10,
  "agent_result": "OK",
  "agent_action": "colgar",
  "agent_response": "Gracias por llamar al servicio de reservas demo. ¡Hasta pronto!",
  "result": "AGENT_OK_ACTION",
  "destination": 0,
  "destination_name": "colgar"
}`,
  },
];

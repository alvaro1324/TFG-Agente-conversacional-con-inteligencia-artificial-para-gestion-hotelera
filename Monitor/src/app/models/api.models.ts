import { CapturePayload, YesNo } from './conversation.models';

/**
 * Parámetros soportados por el endpoint de conversación.
 */
export interface ConversationQueryParams {
  confid?: string;
  ani?: string;
  serviceId?: string | number;
  nodeId?: string | number;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Parámetros soportados por el endpoint de entidades capturadas.
 */
export interface CapturedEntitiesQueryParams {
  confid?: string;
  ani?: string;
  interactionCount?: number;
  end?: YesNo;
}

/**
 * Fila cruda devuelta por el endpoint histórico de conversación.
 *
 * Mantiene el contrato del backend con naming original en snake_case para
 * evitar transformaciones adicionales en la capa HTTP.
 */
export interface ConversationApiRow {
  id: number;
  node_id: number | string;
  node_name: string;
  service_id: number | string;
  service_number: string;
  service_name: string;
  client_id: number | string;
  afiliate_id: number | string;
  agent_timeout: number | string;
  agent_endpoint: string;
  exit_on_agent_error: number | boolean;
  transcription_model: string;
  transcription_version: string;
  transcription_language: string;
  transcription_endpointing: number | string | null;
  transcription_extra: string | null;
  transcription_tag: string | null;
  transcription_grammar: string | null;
  max_attempts: number;
  transcription_bargein: number | boolean;
  transcription_completetimeout: number | string | null;
  transcription_incompletetimeout: number | string | null;
  transcription_maxspeechtimeout: number | string | null;
  transcription_timeout: number | string | null;
  transcription_confidencelevel: number | string | null;
  transcription_sensitivity: number | string | null;
  transcription_recordutterance: number | boolean;
  tts_provider: string;
  tts_voice: string;
  ani: string;
  confid: string;
  transcription_timestamp: string | null;
  transcription_result: 'MATCH' | 'NOMATCH' | 'NOINPUT' | 'HANGUP' | string | null;
  transcription_text: string | null;
  transcription_text_confidencelevel: number | string | null;
  waveform_uri: string | null;
  recording_file: string | null;
  recording_size: number | null;
  recording_duration: number | null;
  input_attempt: number | null;
  attempt_status: 'RETRY' | 'RUNOUT' | string | null;
  interaction_count: number;
  interaction_epoch: number | string;
  agent_request_timestamp: string | null;
  agent_result: 'OK' | 'KO' | 'TIMEOUT' | 'HANGUP' | string | null;
  agent_error: string | null;
  agent_action: string | null;
  agent_response: string | null;
  agent_process_time: number | string | null;
  result: string;
  destination: number | string | null;
  destination_name: string | null;
  timestamp_inserted: string;
}

/**
 * Respuesta normalizada del endpoint de entidades capturadas.
 */
export type CapturedEntitiesResponse = CapturePayload;

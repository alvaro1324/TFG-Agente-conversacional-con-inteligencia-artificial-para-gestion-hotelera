import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConversationApiRow, ConversationQueryParams } from '../models/api.models';
import { API_ENDPOINTS } from './api-endpoints';

/**
 * Cliente HTTP para consultar el histórico de conversación por REST.
 */
@Injectable({ providedIn: 'root' })
export class ConversationApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = API_ENDPOINTS.conversation;

  /**
   * Recupera el histórico de conversación desde el endpoint REST.
   *
   * @param params Filtros opcionales de búsqueda.
   * @returns Observable con las filas de conversación devueltas por backend.
   */
  getConversation(params: ConversationQueryParams = {}): Observable<ConversationApiRow[]> {
    return this.http.get<ConversationApiRow[]>(this.endpoint, {
      params: this.buildParams(params),
    });
  }

  /**
   * Recupera la conversación asociada a un `confid` concreto.
   *
   * @param confid Identificador único de conversación.
   * @returns Observable con las filas asociadas al `confid`.
   */
  getConversationByConfid(confid: string): Observable<ConversationApiRow[]> {
    return this.getConversation({ confid });
  }

  /**
   * Convierte el objeto de filtros de dominio en `HttpParams`.
   *
   * Omite claves vacías para no contaminar la query string.
   *
   * @param params Parámetros lógicos de consulta.
   * @returns Instancia de `HttpParams` lista para el cliente HTTP.
   */
  private buildParams(params: ConversationQueryParams): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }
}

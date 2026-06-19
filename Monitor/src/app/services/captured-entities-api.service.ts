import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CapturedEntitiesResponse,
} from '../models/api.models';
import { API_ENDPOINTS } from './api-endpoints';

/**
 * Cliente HTTP para consultar las entidades capturadas por el agente.
 */
@Injectable({ providedIn: 'root' })
export class CapturedEntitiesApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = API_ENDPOINTS.capturedEntities;

  /**
   * Recupera las entidades capturadas por el agente mediante el endpoint REST.
   *
   * Envía el `confid` en el body mediante `POST`.
   *
   * @param confid Identificador único de conversación.
   * @returns Observable con la respuesta agregada de entidades.
   */
  getCapturedEntities(confid: string): Observable<CapturedEntitiesResponse> {
    return this.http.post<CapturedEntitiesResponse>(this.endpoint, {
      confid,
    });
  }

  /**
   * Recupera las entidades capturadas asociadas a un `confid`.
   *
   * @param confid Identificador único de conversación.
   * @returns Observable con la captura asociada.
   */
  getCapturedEntitiesByConfid(confid: string): Observable<CapturedEntitiesResponse> {
    return this.getCapturedEntities(confid);
  }
}

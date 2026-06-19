import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


/**
 * Respuesta del endpoint de autenticación websocket.
 */
export interface WsLoginResponse {
    server: string;
    token: string;
    status?: string;
    permissions?: unknown;
}

/**
 * Servicio responsable de obtener las credenciales de acceso al websocket.
 */
@Injectable({ providedIn: 'root' })
export class WsAuthService {
    constructor(private http: HttpClient) { }

    /**
     * Solicita al backend las credenciales necesarias para abrir el websocket.
     *
     * Construye el payload base a partir del contexto persistido en
     * `localStorage` y permite sobrescribir o ampliar cualquier campo mediante
     * el parámetro opcional.
     *
     * @param payload Campos adicionales o alternativos para el login WS.
     * @returns Observable con la URL del servidor y el token de conexión.
     */
    loginWs(payload?: Partial<Record<string, unknown>>): Observable<WsLoginResponse> {
        const body = {
            // REDACTADO: aqui iria el identificador interno de usuario o SSO.
            id: '',
            // REDACTADO: aqui iria el indicador interno usado por el backend para sesiones de prueba.
            userFaked: '',
            // REDACTADO: aqui iria el codigo interno de la aplicacion cliente.
            app: '',
            // REDACTADO: aqui iria el identificador persistente del dispositivo cliente.
            deviceId: '',
            // REDACTADO: aqui iria el identificador temporal de sesion generado para el login websocket.
            session: Date.now(),
            ...payload
        };

        return this.http.post<WsLoginResponse>(environment.login, body);
    }
}

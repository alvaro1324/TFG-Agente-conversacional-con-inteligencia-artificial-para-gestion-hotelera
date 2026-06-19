import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RealtimeSocketService } from './realtime-socket.service';
import { WsAuthService } from './ws-auth.service';

/**
 * Servicio de inicialización temprana del canal websocket.
 */
@Injectable({ providedIn: 'root' })
export class AppInitService {
    constructor(
        private wsAuthService: WsAuthService,
        private realtimeSocketService: RealtimeSocketService
    ) { }

    /**
     * Inicializa la capa websocket de la aplicación.
     *
     * Solicita las credenciales de acceso al backend y, si la respuesta incluye
     * servidor y token, establece la conexión socket para el resto de servicios
     * que dependen de eventos en tiempo real.
     *
     * @returns Promesa resuelta cuando el flujo de inicialización termina.
     */
    async init(): Promise<void> {
        try {
            const response = await firstValueFrom(this.wsAuthService.loginWs());

            if (!response?.server || !response?.token) {
                console.error('Respuesta WS incompleta', response);
                return;
            }

            this.realtimeSocketService.connect(response.server, response.token);
        } catch (error) {
            console.error('No se pudo iniciar login WS', error);
        }
    }
}

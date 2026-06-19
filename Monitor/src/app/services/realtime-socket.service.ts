import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export const SOCKET_IO_FACTORY = new InjectionToken<typeof io>('SOCKET_IO_FACTORY', {
    providedIn: 'root',
    factory: () => io,
});

/**
 * Evento genérico recibido desde el socket cuando se escucha de forma global.
 *
 * @typeParam T Tipo esperado del payload del evento.
 */
export interface RealtimeSocketEvent<T = unknown> {
    name: string;
    payload: T;
}

/**
 * Servicio de acceso centralizado al websocket de la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSocketService {
    private readonly socketFactory = inject(SOCKET_IO_FACTORY);
    private socket: Socket | null = null;

    /**
     * Abre la conexión websocket contra el servidor indicado.
     *
     * Si ya existe una conexión activa, no vuelve a inicializar el socket.
     * Durante la conexión registra los manejadores básicos de ciclo de vida y
     * emite el evento `start` al completar el handshake.
     *
     * @param server URL del servidor socket.
     * @param token Token de autenticación entregado por el backend.
     */
    connect(server: string, token: string): void {
        if (this.socket?.connected) {
            return;
        }

        this.socket = this.socketFactory(server, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            query: { token }
        });

        this.socket.on('connect', () => {
            console.log('WS conectado');

            this.socket?.emit('start', (result: unknown) => {
                console.log('Realtime iniciado', result);
            });
        });

        this.socket.on('disconnect', (reason: string) => {
            console.log('WS desconectado', reason);
        });

        this.socket.on('connect_error', (error: unknown) => {
            console.error('Error de conexion WS', error);
        });

        this.socket.on('error', (error: unknown) => {
            console.error('Error WS', error);
        });
    }

    /**
     * Escucha todos los eventos recibidos por el socket activo.
     *
     * Resulta útil para depuración o para flujos dinámicos donde todavía no se
     * conoce el nombre exacto de todos los eventos emitidos por backend.
     *
     * @returns Observable con el nombre del evento y su payload.
     */
    listenAll(): Observable<RealtimeSocketEvent> {
        return new Observable<RealtimeSocketEvent>((observer) => {
            if (!this.socket) {
                observer.error(new Error('Socket no inicializado'));
                return;
            }

            const handler = (eventName: string, payload: unknown) => observer.next({
                name: eventName,
                payload
            });

            this.socket.onAny(handler);

            return () => {
                this.socket?.offAny(handler);
            };
        });
    }

    /**
     * Escucha un evento concreto del socket.
     *
     * @typeParam T Tipo esperado del payload emitido por el evento.
     * @param event Nombre del evento socket a escuchar.
     * @returns Observable que emite cada payload recibido para ese evento.
     */
    listen<T = unknown>(event: string): Observable<T> {
        return new Observable<T>((observer) => {
            if (!this.socket) {
                observer.error(new Error('Socket no inicializado'));
                return;
            }

            const handler = (data: T) => observer.next(data);
            this.socket.on(event, handler);

            return () => {
                this.socket?.off(event, handler);
            };
        });
    }

    /**
     * Emite un evento a través del socket actual.
     *
     * @param event Nombre del evento a emitir.
     * @param payload Datos opcionales asociados al evento.
     */
    emit(event: string, payload?: unknown): void {
        this.socket?.emit(event, payload);
    }

    /**
     * Cierra la conexión websocket actual y limpia la referencia interna.
     */
    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }
}

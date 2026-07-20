import { Injectable, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface JobUpdate { jobId: string; status: string; progress?: object; message?: string; error?: string; }
export interface JobLog { message: string; }

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private subjects = new Map<string, Subject<any>>();

  jobUpdate$ = new Subject<JobUpdate>();
  jobLog$ = new Subject<JobLog>();
  jobProgress$ = new Subject<object>();
  captchaAlert$ = new Subject<{ jobId: string }>();

  isConnected = signal(false);

  connect(userId: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.wsUrl, { withCredentials: true });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.socket?.emit('join', userId);
    });

    this.socket.on('disconnect', () => this.isConnected.set(false));

    this.socket.on('job:update',    (data: JobUpdate) => { this.jobUpdate$.next(data); this.emit('job:update', data); });
    this.socket.on('job:log',       (data: JobLog)    => { this.jobLog$.next(data); this.emit('job:log', data); });
    this.socket.on('job:progress',  (data: object)    => { this.jobProgress$.next(data); this.emit('job:progress', data); });
    this.socket.on('job:captcha',   (data: { jobId: string }) => { this.captchaAlert$.next(data); this.emit('captcha:detected', data); });
    this.socket.on('lead:updated',  (data: any)       => this.emit('lead:updated', data));
    this.socket.on('job:error',     (data: any)       => this.emit('job:error', data));
  }

  /** Generic event subscriber — returns an Observable for any Socket.io event */
  onMessage<T>(event: string): Observable<T> {
    if (!this.subjects.has(event)) {
      this.subjects.set(event, new Subject<T>());
      // If socket already connected, attach listener
      this.socket?.on(event, (data: T) => this.emit(event, data));
    }
    return this.subjects.get(event)!.asObservable();
  }

  private emit(event: string, data: any): void {
    this.subjects.get(event)?.next(data);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected.set(false);
  }

  ngOnDestroy(): void { this.disconnect(); }
}


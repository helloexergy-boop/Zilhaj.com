/**
 * RealtimeSyncClient - Client-side real-time channel subscription & optimistic UI helper
 * Connects to SSE endpoint /api/realtime/stream
 */
(function (global) {
    class RealtimeSyncClient {
        constructor(options = {}) {
            this.baseUrl = options.baseUrl || '';
            this.channels = new Set(options.channels || []);
            this.eventSource = null;
            this.listeners = new Map(); // eventName -> Set of callbacks
            this.reconnectAttempts = 0;
            this.maxReconnectDelay = 15000;
        }

        /**
         * Subscribe to specified real-time channel(s)
         */
        subscribe(channels) {
            const list = Array.isArray(channels) ? channels : [channels];
            list.forEach(c => this.channels.add(c));
            this.connect();
        }

        /**
         * Connect or reconnect EventSource connection
         */
        connect() {
            if (this.channels.size === 0) return;
            if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
                this.eventSource.close();
            }

            const channelParam = Array.from(this.channels).join(',');
            const url = `${this.baseUrl}/api/realtime/stream?channels=${encodeURIComponent(channelParam)}`;

            try {
                this.eventSource = new EventSource(url);

                this.eventSource.onopen = () => {
                    console.log('[REALTIME CLIENT] Connected to SSE stream channels:', Array.from(this.channels));
                    this.reconnectAttempts = 0;
                };

                this.eventSource.onerror = (err) => {
                    console.warn('[REALTIME CLIENT] SSE connection lost. Retrying...', err);
                    this.eventSource.close();
                    this.scheduleReconnect();
                };

                // Register event listeners
                this.listeners.forEach((callbacks, eventName) => {
                    this.eventSource.addEventListener(eventName, (e) => {
                        try {
                            const parsed = JSON.parse(e.data);
                            callbacks.forEach(cb => cb(parsed.payload, parsed));
                        } catch (err) {
                            console.error(`[REALTIME CLIENT] Error parsing event [${eventName}]:`, err);
                        }
                    });
                });
            } catch (err) {
                console.error('[REALTIME CLIENT] Failed to initialize EventSource:', err);
                this.scheduleReconnect();
            }
        }

        /**
         * Register event listener for real-time events
         */
        on(eventName, callback) {
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set());
                if (this.eventSource) {
                    this.eventSource.addEventListener(eventName, (e) => {
                        try {
                            const parsed = JSON.parse(e.data);
                            this.listeners.get(eventName).forEach(cb => cb(parsed.payload, parsed));
                        } catch (err) {
                            console.error(`[REALTIME CLIENT] Error handling event [${eventName}]:`, err);
                        }
                    });
                }
            }
            this.listeners.get(eventName).add(callback);
        }

        /**
         * Optimistic UI update helper with automatic rollback capability
         */
        optimisticUpdate({ apply, rollback, action }) {
            try {
                apply();
                action().catch((err) => {
                    console.error('[OPTIMISTIC UI] Action failed, executing rollback:', err);
                    rollback(err);
                });
            } catch (err) {
                console.error('[OPTIMISTIC UI] Optimistic apply error, executing rollback:', err);
                rollback(err);
            }
        }

        scheduleReconnect() {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
            setTimeout(() => this.connect(), delay);
        }

        disconnect() {
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
            }
        }
    }

    global.RealtimeSyncClient = RealtimeSyncClient;
})(typeof window !== 'undefined' ? window : global);

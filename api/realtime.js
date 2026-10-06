/**
 * Real-Time Engine (Server-Sent Events & Pub/Sub Broadcaster)
 * Manages live subscription channels:
 *  - request:{requestId}   -> inventory offers attached by specialists
 *  - user:{userId}:bookings -> booking confirmations and status changes
 *  - ops:queue            -> streams incoming requests to operations personnel
 */

class RealtimeServerEngine {
    constructor() {
        // Map of channelName -> Set of HTTP Response objects
        this.channels = new Map();
        this.initHeartbeat();
    }

    /**
     * Subscribe a client HTTP response stream to one or more channels
     */
    subscribe(req, res, channelList = []) {
        const channelsToSubscribe = Array.isArray(channelList) ? channelList : [channelList];

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders && res.flushHeaders();

        // Send initial connection ACK
        res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', channels: channelsToSubscribe, timestamp: new Date() })}\n\n`);

        channelsToSubscribe.forEach(channelName => {
            if (!this.channels.has(channelName)) {
                this.channels.set(channelName, new Set());
            }
            this.channels.get(channelName).add(res);
        });

        const cleanup = () => {
            channelsToSubscribe.forEach(channelName => {
                if (this.channels.has(channelName)) {
                    this.channels.get(channelName).delete(res);
                    if (this.channels.get(channelName).size === 0) {
                        this.channels.delete(channelName);
                    }
                }
            });
        };

        req.on('close', cleanup);
        req.on('end', cleanup);
        res.on('error', cleanup);
    }

    /**
     * Publish an event to a specified channel
     */
    publish(channelName, eventName, payload) {
        const subscribers = this.channels.get(channelName);
        const eventData = {
            channel: channelName,
            event: eventName,
            payload,
            timestamp: new Date().toISOString()
        };

        const formattedMessage = `event: ${eventName}\ndata: ${JSON.stringify(eventData)}\n\n`;

        if (subscribers && subscribers.size > 0) {
            subscribers.forEach(res => {
                try {
                    res.write(formattedMessage);
                } catch (e) {
                    console.warn(`[REALTIME] Error writing to subscriber on ${channelName}:`, e.message);
                }
            });
            console.log(`[REALTIME] Broadcasted [${eventName}] to ${subscribers.size} client(s) on channel [${channelName}].`);
        } else {
            console.log(`[REALTIME] Published [${eventName}] to channel [${channelName}] (0 active SSE subscribers).`);
        }

        // Also publish to WILDCARD channel if applicable
        if (channelName !== 'all') {
            const globalSubscribers = this.channels.get('all');
            if (globalSubscribers) {
                globalSubscribers.forEach(res => {
                    try { res.write(formattedMessage); } catch (e) {}
                });
            }
        }
    }

    /**
     * Send periodic heartbeat pings every 20 seconds to keep connection alive through proxies
     */
    initHeartbeat() {
        setInterval(() => {
            for (const [channelName, subscribers] of this.channels.entries()) {
                subscribers.forEach(res => {
                    try {
                        res.write(`:ping\n\n`);
                    } catch (e) {
                        subscribers.delete(res);
                    }
                });
            }
        }, 20000);
    }
}

const realtimeEngine = new RealtimeServerEngine();

module.exports = realtimeEngine;

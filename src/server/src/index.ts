import { metrics } from './online/metrics.js';
import express from "express";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";
import { allowedOrigin, connectionPolicy, RateLimit } from "./online/requestLimits.js";
const port = Number(process.env.PORT ?? 2567);
const origins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && !origins.length) {
    throw new Error('公開環境では ALLOWED_ORIGINS を指定してください');
}
const policy = connectionPolicy(origins);
const localRate = new RateLimit(30, 60000);
const originAllowed = (origin: string | undefined) => !origins.length || allowedOrigin(origin, origins);
class ArenaServer extends Server {
    protected async handleMatchMakeRequest(req: IncomingMessage, res: ServerResponse) {
        // プロキシ配下の公開環境だけ、信頼する末尾の転送元アドレスを使用する。
        const forwarded = process.env.TRUST_PROXY === '1' ? req.headers['x-forwarded-for'] : undefined;
        const ip = typeof forwarded === 'string' ? forwarded.split(',').at(-1)!.trim() : req.socket.remoteAddress ?? 'unknown';
        const status = req.method === 'OPTIONS'
            ? (originAllowed(req.headers.origin) ? 200 : 403)
            : origins.length ? policy(req.headers.origin, ip) : localRate.allow(ip) ? 200 : 429;
        if (status !== 200) {
            res.writeHead(status);
            res.end();
            return;
        }
        if (Number(req.headers['content-length'] ?? 0) > 8192) {
            res.writeHead(413);
            res.end();
            return;
        }
        let bytes = 0;
        req.on('data', chunk => { bytes += chunk.length; if (bytes > 8192)
            req.destroy(); });
        return super.handleMatchMakeRequest(req, res);
    }
}
class MeasuredTransport extends WebSocketTransport {
    constructor(options: ConstructorParameters<typeof WebSocketTransport>[0]) {
        super(options);
        this.wss.on('connection', socket => {
            const send = socket.send;
            socket.send = function (data: any, ...args: any[]) { metrics.sentBytes += typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength ?? data.length ?? 0; return (send as any).call(this, data, ...args); };
        });
    }
}
const app = express();
const httpServer = createServer(app);
app.get('/health', (_request, response) => response.json({ ok: true }));
if (process.env.ENABLE_METRICS === '1')
    app.get('/metrics', (_request, response) => response.json(metrics.snapshot()));
const gameServer = new ArenaServer({
    transport: new MeasuredTransport({ server: httpServer, maxPayload: 8192,
        verifyClient: (info: {
            origin: string;
        }) => originAllowed(info.origin || undefined)
    })
});
gameServer.define('arena', ArenaRoom);
gameServer.listen(port, '0.0.0.0').then(() => console.log('Colyseus server listening on http://localhost:' + port));

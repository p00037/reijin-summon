export class RateLimit {
    private entries = new Map<string, {
        start: number;
        count: number;
    }>();
    constructor(private maximum: number, private periodMs: number) { }
    allow(key: string, now = Date.now()) { let entry = this.entries.get(key); if (!entry || now - entry.start >= this.periodMs) {
        entry = { start: now, count: 0 };
        this.entries.set(key, entry);
    } entry.count++; if (this.entries.size > 1000)
        for (const [k, v] of this.entries)
            if (now - v.start >= this.periodMs)
                this.entries.delete(k); return entry.count <= this.maximum; }
}
export function allowedOrigin(origin: string | undefined, allowed: string[]) { return !!origin && allowed.includes(origin); }
export function connectionPolicy(origins: string[], maximum = 30) {
    const rate = new RateLimit(maximum, 60000);
    return (origin: string | undefined, ip: string, now = Date.now()): 200 | 403 | 429 => {
        if (!allowedOrigin(origin, origins))
            return 403;
        return rate.allow(ip, now) ? 200 : 429;
    };
}

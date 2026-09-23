// 検証環境でだけ公開する、個人情報を含まない集計値。
class Metrics {
    private samples: number[] = [];
    ticks = 0;
    sentBytes = 0;
    maxPendingMs = 0;
    record(duration: number, pendingMs: number) { this.ticks++; this.samples.push(duration); if (this.samples.length > 12000)
        this.samples.shift(); this.maxPendingMs = Math.max(this.maxPendingMs, pendingMs); }
    snapshot() { const sorted = [...this.samples].sort((a, b) => a - b); return { ticks: this.ticks, tickP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0, maxPendingMs: this.maxPendingMs, rssBytes: process.memoryUsage().rss, sentBytes: this.sentBytes }; }
}
export const metrics = new Metrics();

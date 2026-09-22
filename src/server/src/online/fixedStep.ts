export class FixedStep {
    pendingMs = 0;
    advance(elapsedMs: number, update: (seconds: number) => void) {
        this.pendingMs += Math.max(0, elapsedMs);
        while (this.pendingMs >= 50) {
            this.pendingMs -= 50;
            update(.05);
        }
    }
}

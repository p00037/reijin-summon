import { randomInt, randomUUID } from 'node:crypto';
export class RoomRegistry {
    private rooms = new Map<string, Set<string>>();
    private seats = new Map<string, string>();
    get occupiedSeats() { return this.seats.size; }
    create() { let code: string; do {
        code = String(randomInt(100000, 1000000));
    } while (this.rooms.has(code)); this.rooms.set(code, new Set()); return code; }
    reserve(code: string) { const room = this.rooms.get(code); if (!room)
        throw Error('部屋が見つかりません'); if (this.seats.size >= 10 || room.size >= 2)
        throw Error('満員です'); const id = randomUUID(); room.add(id); this.seats.set(id, code); return id; }
    release(id: string) { const code = this.seats.get(id); if (!code)
        return; this.rooms.get(code)?.delete(id); this.seats.delete(id); }
    close(code: string) { for (const id of this.rooms.get(code) ?? [])
        this.seats.delete(id); this.rooms.delete(code); }
}
export const roomRegistry = new RoomRegistry();

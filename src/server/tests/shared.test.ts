import test from 'node:test';
import assert from 'node:assert/strict';
test('共有戦闘をNodeから読み込んで進行できる', async () => {
    const { GameSession } = await import('@reijin-summon/shared');
    const session = new GameSession();
    session.applyCommand({ commandType: 'StartBattle', team: 'Player' });
    session.tick(5);
    session.tick(1);
    assert.equal(session.state.remainingSeconds, 299);
});

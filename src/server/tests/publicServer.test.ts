import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import WebSocket from 'ws';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('公開用HTTP/WS接続元、PORT、サイズ、偽装IPの制限',async()=>{
 const server=spawn(process.execPath,['--import','tsx','src/index.ts'],{env:{...process.env,PORT:'2680',NODE_ENV:'production',ALLOWED_ORIGINS:'https://game.example',TRUST_PROXY:'0'},stdio:'pipe',windowsHide:true});let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
 try{
  const start=Date.now();while(!logs.includes('listening')){if(Date.now()-start>10000)throw Error(logs);await delay(50);}
  const base='http://127.0.0.1:2680';assert.deepEqual(await (await fetch(base+'/health')).json(),{ok:true});
  const request=(origin:string,body='{}',ip='forged')=>fetch(base+'/matchmake/joinById/123456',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Forwarded-For':ip},body});
  assert.equal((await request('https://evil.example')).status,403);
  assert.equal((await request('https://game.example.evil.example')).status,403);
  const preflight=await fetch(base+'/matchmake/create/arena',{method:'OPTIONS',headers:{Origin:'https://game.example'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://game.example');
  assert.equal((await request('https://game.example','x'.repeat(8193))).status,413);
  for(let i=0;i<29;i++)assert.equal((await request('https://game.example','{}','forged-'+i)).status,200);
  assert.equal((await request('https://game.example','{}','new-ip')).status,429);
  await new Promise<void>((resolve,reject)=>{const ws=new WebSocket('ws://127.0.0.1:2680/no/room',{origin:'https://evil.example'});ws.on('open',()=>{ws.close();reject(Error('不正な接続元で接続した'));});ws.on('error',error=>{try{assert.match(error.message,/401/);resolve();}catch(e){reject(e);}});});
 }finally{server.kill();}
});
test('本番で許可元未設定なら起動しない',async()=>{
 const server=spawn(process.execPath,['--import','tsx','src/index.ts'],{env:{...process.env,PORT:'2681',NODE_ENV:'production',ALLOWED_ORIGINS:''},stdio:'pipe',windowsHide:true});let stderr='';server.stderr.on('data',d=>stderr+=d);const code=await new Promise(r=>server.on('exit',r));assert.notEqual(code,0);assert.match(stderr,/ALLOWED_ORIGINS/);
});

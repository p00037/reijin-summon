# reijin-summon

TypeScript + Phaser client and Node.js + Colyseus server starter.

## Requirements

- Node.js 22 or newer
- npm

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by the script execution policy.

## Setup

```powershell
npm.cmd install
```

## Development

Run the Colyseus server and Phaser client together:

```powershell
npm.cmd run dev
```

- Client: http://localhost:5173
- Server: http://localhost:2567
- Health check: http://localhost:2567/health

ローカルCOM戦MVPだけを確認する場合は、クライアント単体で起動できます。
サーバーは不要です。

```powershell
npm.cmd run dev:client
```

- Client: http://localhost:5173

## Build

```powershell
npm.cmd run build
```

## Project Structure

```text
src/
  client/   # TypeScript + Phaser + Vite
  server/   # Node.js + Colyseus + TypeScript
```

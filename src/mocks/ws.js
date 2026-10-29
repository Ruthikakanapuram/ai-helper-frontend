import { Server } from 'mock-socket';
export const mockWsUrl = 'ws://localhost:12345/activity';
let server;
export function emit(event) { if (server)
    server.emit('message', JSON.stringify(event)); }
export function startMockWebSocket() { if (server)
    return; server = new Server(mockWsUrl); server.on('connection', socket => { socket.send(JSON.stringify({ type: 'connected' })); }); }
export function stopMockWebSocket() { server?.stop(); server = undefined; }

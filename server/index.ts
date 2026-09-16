import express from 'express';
import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import {
  initializeJsonStore,
  isStorageResource,
  readJson,
  writeJson,
  StorageResource,
} from './jsonStore';

const port = Number(process.env.PORT || 3000);
const app = express();
const httpServer = createServer(app);
const socketServer = new WebSocketServer({ noServer: true });

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', storage: 'json', port });
});

app.get('/api/storage/:resource', async (request, response, next) => {
  try {
    if (!isStorageResource(request.params.resource)) {
      response.status(404).json({ error: 'Unknown storage resource' });
      return;
    }
    const value = await readJson(request.params.resource as StorageResource);
    response.json({ items: value });
  } catch (error) {
    next(error);
  }
});

app.put('/api/storage/:resource', async (request, response, next) => {
  try {
    if (!isStorageResource(request.params.resource)) {
      response.status(404).json({ error: 'Unknown storage resource' });
      return;
    }
    await writeJson(request.params.resource as StorageResource, request.body);
    const message = JSON.stringify({
      type: 'storage-updated',
      resource: request.params.resource,
      value: request.body,
      source: request.header('x-client-id') || null,
    });
    socketServer.clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(message);
    });
    response.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

const vite = await createViteServer({
  server: { middlewareMode: true, hmr: false, watch: { ignored: ['**/server/data/**'] } },
  appType: 'spa',
});
app.use(vite.middlewares);

await initializeJsonStore();
httpServer.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    socketServer.handleUpgrade(request, socket, head, (client) => {
      socketServer.emit('connection', client, request);
    });
  } else {
    socket.destroy();
  }
});

socketServer.on('connection', (client) => {
  client.send(JSON.stringify({ type: 'connected', storage: 'json' }));
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Local CBT backend running at http://localhost:${port}`);
  console.log('JSON storage directory: server/data');
});

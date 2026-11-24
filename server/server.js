import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import { attachMeetingSocket } from './socket/meetingSocket.js';

async function startServer() {
  try {
    await connectDB();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin(origin, callback) {
          if (env.isOriginAllowed(origin)) return callback(null, true);
          return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
        },
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
      },
    });

    app.set('io', io);
    attachMeetingSocket(io);

    server.listen(env.port, () => {
      console.log(`TFounZ Studio server running on http://localhost:${env.port}`);
      console.log(`Filmy AI upstream: ${env.filmyAiUrl}`);
      console.log(`SounZ AI upstream: ${env.sounzAiUrl}`);
    });
  } catch (err) {
    console.error('Failed to start TFounZ server:', err.message);
    process.exit(1);
  }
}

startServer();

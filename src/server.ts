import 'dotenv/config';
import Server from "./server/Server";

const server: Server = Server.getInstance();

server.connect(8080, {
    cors: {
        origin: process.env.CORS_URI,
        methods: ["GET", "POST"]
    }
});

process.on('unhandledRejection', (reason, promise) => {
    throw reason;
});

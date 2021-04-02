import 'dotenv/config';
import Server from "./server/Server";

const server: Server = Server.getInstance();

const PORT: number = +process.env.PORT | 8080;

server.connect(PORT, {
    cors: {
        origin: process.env.CORS_URI,
        methods: ["GET", "POST"]
    }
});

process.on('unhandledRejection', (reason, promise) => {
    throw reason;
});

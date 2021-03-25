import {createServer, Server as ServerHttp} from "http";
import {Server as ServerIo, ServerOptions, Socket} from "socket.io";
import {randomBytes} from 'crypto';
import Game from "../Game/Game";
import Player from "../Game/Player";
import {logger} from "../Logger/Logger";

// Server singleton
export default class Server {
    private static _instance: Server; // Server instance
    private io: ServerIo; // SocketIo server
    private http: ServerHttp; // Http server
    private games: Map<string, Game>; // Map for every game <id, Game>

    constructor() {
        this.games = new Map<string, Game>();
    }

    // Get the server instance
    public static getInstance(): Server {
        if (!Server._instance)
            Server._instance = new Server();

        return Server._instance;
    }

    // Get the games into an array
    getGamesArray(): Game[] {
        return Array.from(this.games.values());
    }

    // Create the http server
    createHttp(): void {
        this.http = createServer();
        logger.debug("Http server created", { label: "Server" });
    }

    // Create the socketIo server
    createSocket(options?: Partial<ServerOptions>): void {
        if (!this.http)
            this.createHttp();
        this.io = new ServerIo(this.http, options);
        logger.debug("SocketIo created", { label: "Server" });
    }

    // Connect the event of the socketIo server
    connectIo() {
        this.io.on('connection', (socket: Socket) => {
            logger.debug(`SocketIo connection [${socket.id}]`, { label: "Server" });
            socket.on("disconnect", () => this.socketDisconnect(socket));
            socket.on("create", () => this.socketCreate(socket));
            socket.on("join", (gameId: string) => this.socketJoin(socket, gameId));
            socket.on("start", (gameId: string) => this.socketStart(socket, gameId));

            // TODO: Delay update
            socket.emit("updateGames", this.getGamesArray().map(game => game.toJson()));

        })
    }

    // Connect the server
    connect(port: number, options?: Partial<ServerOptions>): void {
        if (!this.http)
            this.createHttp();

        if (!this.io)
            this.createSocket(options)

        this.http.listen(port, () => {
            logger.debug(`Server listening on port [${port}]`, { label: "Server" });
        });
        this.connectIo();
    }

    // When a socket disconnect
    socketDisconnect(socket: Socket): void {
        logger.debug(`Socket disconnecting [${socket.id}]`, { label: "Server" });
    }

    // When a game is created
    socketCreate(socket: Socket): void {
        const gameId = randomBytes(10).toString("hex");
        const game = new Game(gameId);
        if (!this.games.get(gameId)) {
            this.games.set(gameId, game);
            logger.debug(`Game created [${gameId}]`, { label: "Server" });
            socket.emit("created", gameId);
        }
        else
            logger.debug(`Game [${gameId}] already created`, { label: "Server" });

        this.updateGames();
    }

    // When a game is join
    socketJoin(socket: Socket, gameId: string): void {
        const game = this.games.get(gameId);
        if (game && game.hasRemainingSlot()) {
            const player = new Player(socket)
            game.addPlayer(player);
            socket.emit("join", gameId);
        }
        else
            logger.debug(`No game [${gameId}] to join`, { label: "Server" });
    }

    // When a game is started
    socketStart(socket: Socket, gameId: string): void {
        const game = this.games.get(gameId);
        if (game)
            game.start();
        else
            logger.debug(`No game [${gameId}] to start`, { label: "Server" });
    }

    // Send data to every socket connected
    sendData(method: string, data?: any) {
        logger.debug(`Send to all [${method}] => ${JSON.stringify(data)} `, { label: "Server" });
        this.io.emit(method, data);
    }

    // Update the game list for everyone
    updateGames() {
        this.sendData("updateGames", this.getGamesArray().map(game => game.toJson()));
    }

    // Remove a game in the map
    removeGame(gameId: string) {
        this.games.delete(gameId);
        logger.debug(`Game [${gameId}] deleted`, { label: "Server" });
        this.updateGames();
    }
}

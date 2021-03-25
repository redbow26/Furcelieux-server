import Player from "./Player";
import Config from "./Config";
import {CAMP} from "./Roles/Role";
import Server from "../server/Server";
import History from './History';
import {logger} from "../Logger/Logger";

enum GAME_SATE {
    waitToStart,
    start,
    night,
    day,
    end
}

export default class Game {
    id: string; // Game id
    players: Player[]; // Player list
    playersToKill: Player[]; // Next players to kill
    state: GAME_SATE; // Current state of this game
    config: Config; // Current config of this game
    history: History; // Current history of this game

    constructor(id: string) {
        this.id = id;
        this.players = [];
        this.playersToKill = [];
        this.state = GAME_SATE.waitToStart
        this.config = new Config();
        this.history = new History(id);
    }

    // Return the game in json format
    toJson() {
        return {
            id: this.id,
            players: this.players.map(player => player.toJson()),
            maxPlayer: this.config.maxPlayer,
            nbPlayer: this.players.length,
            state: this.state
        }
    }

    // Add player in the game
    addPlayer(player: Player) {
        if (this.state != GAME_SATE.waitToStart) {
            const error = new Error(`Game [${this.id}] already started`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }
        if (!this.hasRemainingSlot()) {
            const error = new Error(`No slot remaning on game [${this.id}]`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }


        player.socket.on("disconnect", () => this.removePlayer(player));
        player.socket.on("vote", (playerId: string, votedPlayerId: string) => this.vote(playerId, votedPlayerId));
        player.socket.on("message", (playerId: string, message: string) => this.message(playerId, message));

        this.players.push(player);
        this.history.addHistory("player join", { player: player.allToJson() });
        logger.debug(`Player [${player.id}] join game [${this.id}]`, { label: "Game" });

        this.updatePlayer();
        Server.getInstance().updateGames();
    }

    // Remove player in the game and end it if the players count = 0
    removePlayer(player: Player) {
        player.socket.removeAllListeners("vote");

        this.players = this.players.filter(p => p.id != player.id);
        this.history.addHistory("player leave", { player: player.allToJson() });
        logger.debug(`Player [${player.id}] leave game [${this.id}]`, { label: "Game" });

        player.sendData("leave");
        this.updatePlayer();
        Server.getInstance().updateGames();

        if (this.players.length == 0) {
            Server.getInstance().removeGame(this.id);
        }
    }

    // Send a update of all the players
    updatePlayer(): void {
        this.broadcast("updatePlayer", this.players.map(player => player.toJson()));
    }

    // Check if the game can
    hasRemainingSlot(): boolean {
        return this.config.maxPlayer - this.players.length > 0;
    }

    // Get the player with his id
    getPlayerById(playerId: string): Player {
        return this.players.filter(player => player.id == playerId)[0];
    }

    // Get all the alive player in the game
    getAlivePlayer(): Player[] {
        return this.players.filter(player => player.isAlive);
    }

    // Get all the alive werewolf in the game
    getAliveWerewolf(): Player[] {
        return this.getAlivePlayer().filter(player => player.role.camp == CAMP.WEREWOLF);
    }

    // Get all the alive villager in the game
    getAliveVillager(): Player[] {
        return this.getAlivePlayer().filter(player => player.role.camp == CAMP.VILLAGE);
    }

    // Get the player with the maximum of vote
    getVotedPlayer(): Player[] | null {
        const players = this.getAlivePlayer();
        let maxVote = 0;
        this.players.forEach(player => {
            if (player.voted > maxVote)
                maxVote = player.voted;
        });
        return maxVote == 0 ? [] : players.filter(player => player.voted >= maxVote);
    };

    // Start the game and launch the main game loop
    async start(): Promise<void> {
        if (this.state != GAME_SATE.waitToStart) {
            const error = new Error(`Game [${this.id}] already started`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }

        this.state = GAME_SATE.start
        logger.debug(`Game [${this.id}] start`, { label: "Game" });
        this.getAlivePlayer().forEach(player => player.sendData("start"));

        this.config.generateConfig(this.getAlivePlayer().length);

        // Update role for each player
        for (let i = 0; i < this.players.length ; i++) {
            this.players[i].updateRole(this.config.roles[i]);
        }

        this.state = GAME_SATE.night;
        this.history.addHistory("started", {
            players: this.players.map(player => player.allToJson()),
            config: this.config.toJson()
        });
        logger.debug(`Game [${this.id}] started and start run`, { label: "Game" });
        await this.run();
    }

    // Main game loop
    async run(): Promise<void> {
        while (this.state != GAME_SATE.end) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            switch (this.state) {
                case GAME_SATE.night: {
                    await this.night();
                    this.checkWin();
                    break;
                }
                case GAME_SATE.day: {
                    await this.day();
                    this.checkWin();
                    break;
                }
            }
        }
        this.end();
    }

    // Night state
    async night(): Promise<void> {
        if (this.state != GAME_SATE.night) {
            const error = new Error(`Game [${this.id}] state incorrect [current: ${this.state}] [expected: night]`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }

        const sysMessage = {
            message: "La nuit tombe",
            color: "blue"
        };

        this.sendMessage(this.players, sysMessage);
        this.history.addChat(sysMessage.message,"system");

        this.history.addHistory("night start", { players: this.players.map(player => player.allToJson() )});
        logger.debug(`Game [${this.id}] start night`, { label: "Game" });

        // TODO: chat and wait until it end
        if (this.getAliveWerewolf().length >= 0 ) {
            for (const player of this.getAliveWerewolf()) {
                await player.action(this);
            }
        }

        this.state = GAME_SATE.day;

        this.killVoted(`$name was killed during the night`);

    }

    // Day state
    async day(): Promise<void> {
        if (this.state != GAME_SATE.day) {
            const error = new Error(`Game [${this.id}] state incorrect [current: ${this.state}] [expected: day]`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }
        const sysMessage = {
            message: "Le jour viens de se lever",
            color: "blue"
        };

        this.sendMessage(this.players, sysMessage);
        this.history.addChat(sysMessage.message,"system");
        this.kill();

        this.history.addHistory("day start", { players: this.players.map(player => player.allToJson() )});
        logger.debug(`Game [${this.id}] start day`, { label: "Game" });


        // TODO: chat and wait until it end

        await this.launchVote(this.getAlivePlayer(), this.getAlivePlayer(), this.config.voteTime);


        this.killVoted(`$name was killed by the village`);
        this.kill();

        this.state = GAME_SATE.night;


    }

    // Game ended
    end(): void {
        this.players.forEach(player => this.removePlayer(player));
        this.history.log();
    }

    // Check if the game is win
    checkWin(): void {
        if(this.state == GAME_SATE.start || this.state == GAME_SATE.end) {
            const error = new Error(`Game [${this.id}] is not started or already end`);
            logger.error(error);
            this.history.log();
            this.end();
            //throw error;
        }

        if (this.getAliveVillager().length > 0) {
            if (this.getAliveWerewolf().length <= 0 ) {
                this.state = GAME_SATE.end;
                this.history.addHistory("win", {
                    players: this.players.map(player => player.allToJson()),
                    win: "Win by the village"
                });
                logger.debug(`Game [${this.id}] is win by the villager`, { label: "Game" });
                this.broadcast("win", `Game win by the villager`);
            }
        } else if (this.getAliveWerewolf().length > 0) {
            if (this.getAliveVillager().length <= 0 ) {
                this.state = GAME_SATE.end;
                this.history.addHistory("win", {
                    players: this.players.map(player => player.allToJson()),
                    win: "Win by the werewolf"
                });
                logger.debug(`Game [${this.id}] is win by the werewolf`, { label: "Game" });
                this.broadcast("win", `Game win by the werewolf`);
            }
        }
    }

    // Start the vote for a list of players for a specific list of players
    async launchVote(players: Player[], playersToVote: Player[], time: number): Promise<void> {
        logger.debug(`Game [${this.id}] start vote session`, { label: "Game" });
        this.history.addHistory("start vote", {
            players: players.map(player => player.allToJson()),
            playersToVote: playersToVote.map(player => player.allToJson()),
        });

        players.forEach(player => player.startVote(playersToVote));
        await new Promise(resolve => setTimeout(resolve, time));

        this.history.addHistory("end vote", {
            players: players.map(player => player.allToJson()),
            playersToVote: playersToVote.map(player => player.allToJson()),
        });
        players.forEach(player => player.endVote());
        logger.debug(`Game [${this.id}] end vote session`, { label: "Game" });
    }

    // Handle vote when a player vote on th client
    vote(playerId: string, votedPlayerId: string): void {
        const player: Player = this.getPlayerById(playerId);
        const votedPlayer: Player = this.getPlayerById(votedPlayerId);
        if (player.canVote) {
            logger.debug(`Player [${player.id}] vote for player [${votedPlayer.id}]`, { label: "Game" });
            votedPlayer.voted += player.role.votePower;
            this.history.addHistory("vote", {
                player: player.allToJson(),
                votedPlayer: votedPlayer.allToJson(),
            });
            player.endVote();
        }
    }

    // Add the players voted to the kill list
    killVoted(reason: string) {
        const playerToKill: Player = this.getVotedPlayer()[0];
        if (playerToKill) {
            playerToKill.killReason = reason.replace('$name', `${playerToKill.name}`);
            this.playersToKill.push(playerToKill);
        }
        this.players.forEach(player => player.voted = 0);
    }

    // Kill all the player in the kill list
    kill(): void {
        this.playersToKill.forEach(player => {
            if (this.getAlivePlayer().includes(player)) {
                this.history.addHistory("kill", {
                    player: player.allToJson(),
                });
                player.kill(this);
                this.updatePlayer();
            }
        });
        this.playersToKill = [];
    }

    message(playerId: string, message: string): void {
        const player = this.getPlayerById(playerId);

        if (!player || !player.isAlive)
            return;

        if (this.state != GAME_SATE.night) {
            const dataMessage = {
                message,
                name: player.name,
                color: "black"
            }
            this.history.addChat(message, "all", player.name);
            this.sendMessage(this.players, dataMessage);

        } else {
            if (player.role.camp == CAMP.WEREWOLF) {
                const dataMessage = {
                    message,
                    name: "Loup-garou",
                    color: "red"
                };
                this.history.addChat(message,"werewolf", player.name);
                this.sendMessage(this.getAliveWerewolf(), dataMessage);
            }
        }
    }

    // Broadcast data to every players in the game
    broadcast(method: string, data?): void {
        logger.debug(`Game [${this.id}] broadcast [${method}] => ${JSON.stringify(data)}`, { label: "Game" });
        this.players.forEach(player => player.sendData(method, data))
    }

    // Send message to specific players List
    sendMessage(playersList: Player[], data: any): void {
        logger.debug(`Game [${this.id}] send message ${JSON.stringify(data)}`, { label: "Game" });
        playersList.forEach(player => player.sendData("message", data));
    }
}

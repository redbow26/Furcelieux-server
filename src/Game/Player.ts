import {Socket} from "socket.io";
import Role from "./Roles/Role";
import Game from "./Game";
import {logger} from "../Logger/Logger";

export default class Player {
    id: string; // Player id
    socket: Socket; // Player socket connection
    name: string; // Player name
    role: Role | null; // Player role
    isAlive: boolean; // Player is alive
    voted: number; // How many time the player is voted
    canVote: boolean; // Can the player vote
    killReason: string; // Why this player was killed

    constructor(socket: Socket) {
        this.id = socket.id;
        this.name = this.id;
        this.socket = socket;
        this.role = null;
        this.isAlive = true;
        this.voted = 0;
        this.canVote = false;
        this.killReason = "";
    }

    // Return the player in json format
    toJson() {
        return {
            id: this.id,
            name: this.name,
            isAlive: this.isAlive
        }
    }

    // Return all attributes of the player in json format
    allToJson() {
        return {
            id: this.id,
            name: this.name,
            roles: this.role,
            isAlive: this.isAlive,
            voted: this.voted,
            canVote: this.canVote,
            killReason: this.killReason
        }
    }

    // Update the role of the player
    updateRole(role: Role) {
        this.role = role;
        logger.debug(`Player [${this.id}] update role [${this.role.name}]`, { label: "Player" });
        this.sendData("role", this.role.toJson());
    }

    // Start the vote for this player
    startVote(players: Player[]) {
        this.canVote = true;
        logger.debug(`Player [${this.id}] start vote`, { label: "Player" });
        this.sendData("voteStart", players.map(player => player.toJson()));
    }

    // End the vote for this player
    endVote() {
        this.sendData("voteEnd");
        logger.debug(`Player [${this.id}] end vote`, { label: "Player" });
        this.canVote = false;
    }

    // Kill this player
    kill(game: Game): void {
        this.isAlive = false;
        this.killReason += ` he was ${this.role.name}`;

        logger.debug(`Player [${this.id}] in game [${game.id}] was killed reason [${this.killReason}]`, { label: "Player" });
        game.broadcast("kill", this.killReason);
    }

    // Do the role action
    async action(game: Game): Promise<void> {
        await this.role.action(game, this);
    }

    // Send data to the player client
    sendData(method: string, data?): void {
        logger.debug(`Player [${this.id}] send data [${method}] => ${JSON.stringify(data)}`, { label: "Player" });
        this.socket.emit(method, data);
    }

}

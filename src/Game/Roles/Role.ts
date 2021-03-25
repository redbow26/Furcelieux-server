import Player from "../Player";
import Game from "../Game";
import {logger} from "../../Logger/Logger";

// Camp of the roles
export enum CAMP {
    VILLAGE,
    WEREWOLF,
    NEUTRAL
}

export default abstract class Role {
    name: string; // Name of the role
    description: string; // Description of the role
    camp: CAMP; // Camp for this role
    votePower: number = 1; // Vote power of this roles

    // Return the role in json format
    toJson() {
        return {
            name: this.name,
            description: this.description,
            camp: this.camp
        }
    }

    // Particular role action
    action(game: Game, player: Player) {
        logger.debug(`Start role [${this.name}] action`, { label: "Role" });
    }
}

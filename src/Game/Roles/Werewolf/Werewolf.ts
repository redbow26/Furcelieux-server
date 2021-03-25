import Role, {CAMP} from "../Role";
import Player from "../../Player";
import Game from "../../Game";

export default class Werewolf extends Role {
    name: string = "Werewolf";
    description: string = "A simple werewolf objectives: kill all the villager";
    camp: CAMP = CAMP.WEREWOLF;

    async action(game: Game, player: Player): Promise<void> {
        player.startVote(game.getAliveVillager());
        await new Promise(resolve => setTimeout(resolve, game.config.voteTime));
        player.endVote();
    }
}

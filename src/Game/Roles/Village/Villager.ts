import Role, {CAMP} from "../Role";

export default class Villager extends Role {
    name: string = "Villager";
    description: string = "A simple villager objectives: kill all the werewolf";
    camp: CAMP = CAMP.VILLAGE;
}

import Role from "./Roles/Role";
import {ROLES} from "./Roles";
import {logger} from "../Logger/Logger";

export default class Config {
    villager: number; // Number of villager
    werewolf: number; // Number of werewolf
    isConfigSet: boolean = false; // The config is already set (need to generate random config)
    roles: Role[] = []; // Role list

    maxPlayer: number = 6; // Max player in the game
    voteTime: number = 10 * 1000; // Time in each vote

    // Return config in json format
    toJson() {
        return {
            villager: this.villager,
            werewolf: this.werewolf,
            maxPlayer: this.maxPlayer,
            voteTime: this.voteTime
        }
    }

    // Generate random config
    generateRandomRoles(players: number): void {
        logger.debug(`Generate random config for [${players}] players`, { label: "Config" });
        this.werewolf = 1;
    }

    // Generate a config
    generateConfig(players: number): void {
        logger.debug(`Generate config for [${players}] players`, { label: "Config" });
        if (!this.isConfigSet)
            this.generateRandomRoles(players);

        let count = 0;
        for (let i = 0; i < this.werewolf; i++) {
            this.roles.push(new ROLES["werewolf"])
            count ++;
        }
        // TODO: Add other roles

        this.villager = players - count;
        if (this.villager > 0) {
            for (let i = 0; i < this.villager; i++) {
                this.roles.push(new ROLES["villager"])
            }
        }

        this.shuffleRoles();
    }

    // Shuffle the list of roles
    shuffleRoles(): void {
        for (let i = this.roles.length - 1; i > 0; i--) {
            let randomIndex = Math.floor(Math.random() * (i + 1));
            let temp = this.roles[i];
            this.roles[i] = this.roles[randomIndex];
            this.roles[randomIndex] = temp;
        }
    }
}

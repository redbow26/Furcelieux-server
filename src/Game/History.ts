import {logger} from "../Logger/Logger";

interface IData {
    date: number; // Date when the line is added
    type: string; // Type of data added
    data: any | null; // Data saved in this line
}

interface IChat {
    date: number; // Date when the line is added
    name: string; // User who send the message
    type: string; // Type of the message send (can be "all", "system", "werewolf")
    message: string; // Message send
}

export default class History {
    gameId: string; // Game id associated
    history: IData[]; // All data line
    chat: IChat[]; // All chat history

    constructor (gameId: string) {
        this.gameId = gameId;
        this.history = [];
        this.chat = [];
        this.addHistory("game created");
    }

    // Return the history in json format
    toJson() {
        return {
            gameId: this.gameId,
            history: this.history,
            chat: this.chat
        }
    }

    // Add new line in the history
    addHistory(type: string, data?: any): void {
        const date = Date.now();
        const h: IData = {
            date,
            type,
            data
        };
        this.history.push(h);
    }

    // Add new line in the history
    addChat(message: string, name: string, type: string): void {
        const date = Date.now();
        const m: IChat = {
            date,
            name: name,
            message: message,
            type
        };
        this.chat.push(m);
    }

    // Log the history in the debug logger
    log() {
        logger.debug(`Game history => ${JSON.stringify(this.toJson())}`, { label: "Game" });
    }
}

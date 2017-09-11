import {Server} from 'ws';
import {ServerPlayer} from "./serverPlayer";
import {Message, MessageType, TickMessage} from "@common/messages";
import {ServerBoard} from "./serverBoard";
import {Config} from "@common/config";

export class ServerApp {
    board: ServerBoard;

    constructor() {
        this.board = new ServerBoard();
        this.board.players = [];
        this.board.width = 1000;
        this.board.currentY = 0;
        this.board.currentTick = 0;

        setInterval(() => {
            this.board.tick();
        }, 1000 / Config.ticksPerSecond);

        const wss = new Server({port: 7898});
        console.log('server open');

        wss.on('connection', (ws) => {
            ws.binaryType = "arraybuffer";
            let player = new ServerPlayer(ws);
            this.board.players.push(player);

            ws.on('message', (m: string) => {
                let message = JSON.parse(m) as Message;
                this.board.processMessage(player, message);
            });

            ws.on('close', () => {
                this.board.removePlayer(player);
            });
        });
    }




}

new ServerApp();
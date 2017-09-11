import {Board, Bullet} from "@common/board";
import {AttackMessage, Message, MessageType, MessageUtils, MoveMessage, SyncMessage, SyncPlayer, TickMessage} from "@common/messages";
import {Config} from "@common/config";
import {ClientPlayer} from "./clientPlayer";
import {INoise, noise} from "../perlin";
import {Player, PlayerDirection} from "@common/player";
import {AssetManager} from "../common/assetManager";
import {GameManager} from "./gameManager";

export class ClientBoard extends Board {


    players: ClientPlayer[] = [];
    me: ClientPlayer;
    private noise: INoise = noise;
    private context: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;
    private view: View;

    loadContext(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.context = context;

        this.view = new View();
        this.view.width = this.canvas.width;
        this.view.height = this.canvas.height;
        this.view.follow(this.me);

        let time = +new Date();
        let callback = () => {
            window.requestAnimationFrame(callback);
            let diff = (+new Date()) - time;
            time = +new Date();
            this.clientTick(diff);
            this.draw(diff);
        };
        window.requestAnimationFrame(callback);
    }

    loadBoard(data: SyncMessage, currentTick: number) {
        this.currentTick = currentTick;
        for (let playerData of data.players) {
            let clientPlayer = this.newPlayer(playerData, currentTick);
            if (playerData.me) {
                clientPlayer.me = true;
                this.me = clientPlayer;
            }
        }
    }

    private newPlayer(playerData: SyncPlayer, currentTick: number) {
        let clientPlayer = new ClientPlayer();
        clientPlayer.playerId = playerData.playerId;
        clientPlayer.shipType = playerData.shipType;
        clientPlayer.x = playerData.x;
        clientPlayer.y = this.me ? this.me.y : currentTick * Config.verticalMoveSpeed;
        clientPlayer.moving = playerData.moving;
        clientPlayer.movingStart = playerData.movingStart;
        clientPlayer.movingStartX = playerData.movingStartX;
        clientPlayer.playerName = playerData.playerName;
        this.players.push(clientPlayer);
        return clientPlayer;
    }

    updateBoard(data: SyncMessage, currentTick: number) {
        this.currentTick = currentTick;
        let missingPlayers: ClientPlayer[] = [...this.players];
        for (let playerData of data.players) {
            let clientPlayer = this.players.find(a => a.playerId === playerData.playerId);
            if (clientPlayer) {
                clientPlayer.x = playerData.x;
                clientPlayer.shipType = playerData.shipType;
                clientPlayer.movingStart = playerData.movingStart;
                clientPlayer.movingStartX = playerData.movingStartX;
                // clientPlayer.y = currentTick * Config.verticalMoveSpeed;
                clientPlayer.moving = playerData.moving;
                missingPlayers.splice(missingPlayers.findIndex(a => a === clientPlayer), 1);
            } else {
                this.newPlayer(playerData, currentTick);
            }
        }
        for (let missingPlayer of missingPlayers) {
            this.players.splice(this.players.findIndex(a => a === missingPlayer), 1);
        }
    }

    private clientTick(msDiff: number) {
        let distanceInTick = Config.ticksPerSecond / (1000 / msDiff);

        let y = Math.round(Config.verticalMoveSpeed * distanceInTick);
        let now = +new Date();

        for (let player of this.players) {
            player.y += y;
            if (player.moving === "left") {
                let duration = now - player.movingStart!;
                let distance = Config.horizontalMoveSpeed * (Config.ticksPerSecond / (1000 / duration));
                player.x = player.movingStartX! - distance;
            }
            if (player.moving === "right") {
                let duration = now - player.movingStart!;
                let distance = Config.horizontalMoveSpeed * (Config.ticksPerSecond / (1000 / duration));
                player.x = player.movingStartX! + distance;
            }
            if (player.firingStart) {
                let bulletsEvery = 1000 / player.bulletsPerSecond;
                if ((now - player.firingStart) / bulletsEvery > player.bulletsFired!) {
                    player.bulletsFired!++;
                    this.bullets.push(new Bullet(player.x, player.y, player.bulletVelocity))
                }
            }
        }
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let bullet = this.bullets[i];
            let duration = now - bullet.fireStart;
            let distance = bullet.velocity * (Config.ticksPerSecond / (1000 / duration));
            bullet.y = bullet.startY! + distance;
            if (bullet.startY - bullet.y > 1000) {
                this.bullets.splice(this.bullets.indexOf(bullet), 1)
            }
        }

        GameManager.instance.debugValue("bullets", this.bullets.length);

        this.view.follow(this.me);
    }

    processMessage(player: ClientPlayer, message: Message) {
        this.executeMessage(player, message);
    }

    meStartMove(player: Player, direction: PlayerDirection) {
        player.moving = direction;
        player.movingStart = +new Date();
        player.movingStartX = player.x;
    }

    meFireStart(player: Player) {
        player.firingStart = +new Date();
        player.bulletsFired = 0;
    }

    meFireStop(player: Player) {
        player.firingStart = null;
        player.bulletsFired = null;
    }

    meMoveStop(player: Player) {
        let duration = +new Date() - player.movingStart!;
        let distance = Config.horizontalMoveSpeed * (Config.ticksPerSecond / (1000 / duration));
        player.x = player.movingStartX! + (distance * (player.moving === "left" ? -1 : 1));


        player.moving = "none";
        player.movingStart = null;
        player.movingStartX = null;
    }

    private playerAttack(player: Player, message: AttackMessage) {
        console.log('processing player attack', message)
        if (message.duration > 0) {
            player.firingStart = null;
            player.bulletsFired = null;
        } else {
            player.firingStart = +new Date();
            player.bulletsFired = 0;
        }
    }

    private playerMove(player: Player, message: MoveMessage) {
        console.log('processing player move', message)
        if (player.moving === "none") {
            player.movingStartX = player.x;
            player.moving = message.moving;
            player.movingStart = +new Date();
        } else if (message.moving === "none") {
            // let msDuration = player.movingStart! + message.duration;
            let distance = Config.horizontalMoveSpeed * (Config.ticksPerSecond / (1000 / message.duration));
            player.x = player.movingStartX! + (distance * (player.moving === "left" ? -1 : 1));
            player.moving = "none";
        } else if (message.moving !== player.moving) {
            // let msDuration = player.movingStart! + message.duration;
            let distance = Config.horizontalMoveSpeed * (Config.ticksPerSecond / (1000 / message.duration));
            player.x = player.movingStartX! + (distance * (player.moving === "left" ? -1 : 1));
            player.movingStartX = player.x;
            player.moving = message.moving;
            player.movingStart = +new Date();
        }
    }

    executeMessage(player: Player, message: Message) {
        console.log('executing message', player.playerName, message);
        switch (message.type) {
            case MessageType.Move:
                this.playerMove(player, message);
                break;
            case MessageType.Attack:
                this.playerAttack(player, message);
                break;
        }
    }

    private draw(msDiff: number) {
        let context = this.context;
        context.fillStyle = '#000000';
        context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        context.save();
        context.translate(-this.view.x, -this.view.y);

        context.fillStyle = 'white';

        for (let element of this.getStars()) {
            context.fillStyle = `rgba(255,255,255,${element.n / 2})`;
            context.fillRect(
                element.x,
                element.y,
                16 * element.n,
                16 * element.n
            );
        }
        for (let element of this.bullets) {
            context.fillStyle = `rgba(255,240,76,.7)`;
            context.fillRect(
                element.x - 4,
                element.y - 8,
                8,
                16
            );
        }


        for (let player of this.players) {
            let ship = AssetManager.assets[player.shipType];
            context.drawImage(ship.image, player.x - ship.size.width / 2, player.y - ship.size.height / 2);
        }
        context.restore();

    }

    * getStars(): Iterable<Star> {
        let starX = this.view.starX;
        let starW = starX + this.view.starWidth;
        let starY = this.view.starY;
        let starH = starY + this.view.starHeight;

        for (let x = starX; x < starW + 2; x += 1) {
            for (let y = starY; y < starH + 2; y += 1) {
                let n = this.noise.simplex2(x, y);
                if (n < 1) {
                    yield {x: x * 16, y: y * 16, n: n};
                }
            }
        }
    }

}

export class View {
    x: number;
    y: number;
    width: number;
    height: number;

    get starX(): number {
        return Math.round(this.x / 16);
    }

    get starY(): number {
        return Math.round(this.y / 16);
    }

    get starWidth(): number {
        return Math.round(this.width / 16);
    }

    get starHeight(): number {
        return Math.round(this.height / 16);
    }


    follow({x, y}: { x: number, y: number }) {
        this.x = Math.round(x - this.width / 2);
        this.y = Math.round(y - this.height / 4 * 3);
    }
}

export class Star {
    x: number;
    y: number;
    n: number;
}
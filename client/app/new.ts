enum ActionType {
    Left = "left",
    Right = "right",
    Up = "up",
    Down = "down",
    Shoot = "shoot",
    Bomb = "bomb"
}

enum ActionSubType {
    None = "none",
    Up = "up",
    Down = "down"
}

interface Action {
    actionType: ActionType;
    actionSubType: ActionSubType;
    actionTick?: number,
    entityId: string,
    x: number,
    y: number,
}

interface SocketClient {
    id: string;
    onMessage: (message: ServerMessage) => void;
    sendToServer: (message: ServerMessage) => void;
}

type ServerMessage = {
    messageType: 'start';
    state: WorldState;
    yourEntityId: string
    serverTick: number;
} | {
    messageType: 'action';
    action: Action
} | {
    messageType: 'worldState';
    state: WorldState
}

export class Socket {

    static ClientLatency = 1000;
    static ServerLatency = 1000;

    public static sockets: SocketClient[] = [];
    private static onServerMessage: (clientId: string, message: ServerMessage) => void;

    static onClientJoin: (client: SocketClient) => void;

    static clientJoin(onMessage: (message: ServerMessage) => void) {
        let client = {
            id: (Math.random() * 100000).toFixed(0),
            onMessage: onMessage,
            sendToServer: (message: ServerMessage) => {
                // console.log('send to server', JSON.stringify(message));
                this.sendToServer(client.id, message);
            }
        };
        this.sockets.push(client);
        this.onClientJoin(client);
        return client;
    }

    static createServer(onMessage: (clientId: string, message: ServerMessage) => void, onClientJoin: (client: SocketClient) => void) {
        this.onServerMessage = onMessage;
        this.onClientJoin = onClientJoin;
    }

    static sendToServer(clientId: string, message: ServerMessage) {
        setTimeout(() => {
            this.onServerMessage(clientId, JSON.parse(JSON.stringify(message)));
        }, this.ServerLatency);
    }

    static sendToClient(clientId: string, message: ServerMessage) {
        let client = this.sockets.find(a => a.id === clientId);
        // console.log('send to server', JSON.stringify(message));
        if (client) {
            setTimeout(() => {
                client!.onMessage(JSON.parse(JSON.stringify(message)));
            }, this.ClientLatency);
        }
    }
}

export class ClientGame {
    private serverTick: number;
    private offsetTick: number;
    socketClient: SocketClient;
    private entities: PlayerEntity[] = [];

    get liveEntity(): PlayerEntity {
        return this.entities.find(a => a.live)!;
    }

    constructor() {
    }

    unprocessedActions: Action[] = [];

    get currentServerTick() {
        return this.serverTick + (+new Date() - this.offsetTick);
    }

    sendAction(action: Action) {
        action.actionTick = this.currentServerTick;
        this.socketClient.sendToServer({messageType: 'action', action});
    }

    onConnection(serverTick: number) {
        this.serverTick = serverTick;
        this.offsetTick = +new Date();
    }

    join() {
        this.socketClient = Socket.clientJoin((message) => {
            this.onServerMessage(message);
        })
    }

    private onServerMessage(message: ServerMessage) {
        switch (message.messageType) {
            case "start":
                this.onConnection(message.serverTick);
                this.setServerState(message.state, true);
                this.entities.find(a => a.id === message.yourEntityId)!.live = true;
                break;
            case "worldState":
                this.setServerState(message.state, false);
                break;
            case "action":
                this.unprocessedActions.push(message.action);
                break;
        }
    }

    private setServerState(state: WorldState, initial: boolean) {
        for (let i = 0; i < state.entities.length; i++) {
            let entity = state.entities[i];
            let liveEntity = this.entities.find(a => a.id === entity.id);
            if (!liveEntity) {
                liveEntity = new PlayerEntity(entity.id, this);
                this.entities.push(liveEntity)
            }
            if (!initial && liveEntity.live) {
                continue;
            }

            liveEntity.lastDownAction = entity.lastDownAction;
            liveEntity.color = entity.color;
            liveEntity.x = entity.x;
            liveEntity.y = entity.y;
        }
        for (let i = this.entities.length - 1; i >= 0; i--) {
            let liveEntity = this.entities[i];
            if (!state.entities.find(a => a.id === liveEntity.id)) {
                this.entities.splice(i, 1);
            }
        }
    }

    tick(timeSinceLastTick: number) {
        for (let i = 0; i < this.unprocessedActions.length; i++) {
            let action = this.unprocessedActions[i];
            let entity = this.entities.find(a => a.id === action.entityId);
            if (entity) {
                switch (action.actionSubType) {
                    case ActionSubType.Down: {
                        entity.lastDownAction[action.actionType] = action;
                        break;
                    }
                    case ActionSubType.Up: {
                        entity.processServerUp(action);
                        break;
                    }
                    case ActionSubType.None: {
                        entity.processAction(action);
                        break;
                    }
                }
            }
        }

        this.unprocessedActions.length = 0;
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            entity.tick(timeSinceLastTick, this.currentServerTick);
        }
    }

    draw(context: CanvasRenderingContext2D) {
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            entity.draw(context);
        }
    }
}


export interface WorldState {
    entities: { x: number, color: string, y: number, lastDownAction: { [action: string]: Action }, id: string }[];
    currentTick: number;
}

export class PlayerEntity {
    live: boolean = false;

    constructor(public id: string, private game: ClientGame) {
    }

    x: number = 0;
    y: number = 0;

    speedPerSecond: number = 100;
    color: string;

    pressingLeft = false;
    pressingRight = false;
    wasPressingLeft = false;
    wasPressingRight = false;

    pressingUp = false;
    pressingDown = false;
    wasPressingUp = false;
    wasPressingDown = false;


    pressLeft() {
        this.pressingLeft = true;
    }

    pressRight() {
        this.pressingRight = true;
    }

    releaseLeft() {
        this.pressingLeft = false;
    }

    releaseRight() {
        this.pressingRight = false;
    }

    pressUp() {
        this.pressingUp = true;
    }

    pressDown() {
        this.pressingDown = true;
    }

    releaseUp() {
        this.pressingUp = false;
    }

    releaseDown() {
        this.pressingDown = false;
    }


    tick(timeSinceLastTick: number, currentServerTick: number, isServer: boolean = false) {
        if (!this.live) {
            if (this.lastDownAction[ActionType.Left]) {
                debugger;
                let last = this.lastDownAction[ActionType.Left];
                this.x -= (currentServerTick - last.actionTick!) / 1000 * this.speedPerSecond;

                last.actionTick = currentServerTick;
                last.x = this.x;
                last.y = this.y;
            }
            if (this.lastDownAction[ActionType.Right]) {
                let last = this.lastDownAction[ActionType.Right];
                this.x += (currentServerTick - last.actionTick!) / 1000 * this.speedPerSecond;
                last.actionTick = currentServerTick;
                last.x = this.x;
                last.y = this.y;
            }

            if (this.lastDownAction[ActionType.Up]) {
                let last = this.lastDownAction[ActionType.Up];
                this.y -= (currentServerTick - last.actionTick!) / 1000 * this.speedPerSecond;

                last.actionTick = currentServerTick;
                last.x = this.x;
                last.y = this.y;
            }
            if (this.lastDownAction[ActionType.Down]) {
                let last = this.lastDownAction[ActionType.Down];
                this.y += (currentServerTick - last.actionTick!) / 1000 * this.speedPerSecond;
                last.actionTick = currentServerTick;
                last.x = this.x;
                last.y = this.y;
            }

        } else {
            if (this.pressingLeft) {
                if (!this.wasPressingLeft) {
                    this.game.sendAction({
                        actionType: ActionType.Left,
                        actionSubType: ActionSubType.Down,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingLeft = true;
                }
                this.x -= timeSinceLastTick / 1000 * this.speedPerSecond;
            }
            if (this.pressingRight) {
                if (!this.wasPressingRight) {
                    this.game.sendAction({
                        actionType: ActionType.Right,
                        actionSubType: ActionSubType.Down,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingRight = true;
                }
                this.x += timeSinceLastTick / 1000 * this.speedPerSecond;
            }

            if (this.pressingUp) {
                if (!this.wasPressingUp) {
                    this.game.sendAction({
                        actionType: ActionType.Up,
                        actionSubType: ActionSubType.Down,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingUp = true;
                }
                this.y -= timeSinceLastTick / 1000 * this.speedPerSecond;
            }
            if (this.pressingDown) {
                if (!this.wasPressingDown) {
                    this.game.sendAction({
                        actionType: ActionType.Down,
                        actionSubType: ActionSubType.Down,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingDown = true;
                }
                this.y += timeSinceLastTick / 1000 * this.speedPerSecond;
            }


            if (!this.pressingLeft) {
                if (this.wasPressingLeft) {
                    this.game.sendAction({
                        actionType: ActionType.Left,
                        actionSubType: ActionSubType.Up,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingLeft = false;
                }
            }
            if (!this.pressingRight) {
                if (this.wasPressingRight) {
                    this.game.sendAction({
                        actionType: ActionType.Right,
                        actionSubType: ActionSubType.Up,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingRight = false;
                }
            }

            if (!this.pressingUp) {
                if (this.wasPressingUp) {
                    this.game.sendAction({
                        actionType: ActionType.Up,
                        actionSubType: ActionSubType.Up,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingUp = false;
                }
            }
            if (!this.pressingDown) {
                if (this.wasPressingDown) {
                    this.game.sendAction({
                        actionType: ActionType.Down,
                        actionSubType: ActionSubType.Up,
                        x: this.x,
                        y: this.y,
                        entityId: this.id
                    });
                    this.wasPressingDown = false;
                }
            }
        }
    }


    lastDownAction: { [action: string]: Action } = {};


    draw(context: CanvasRenderingContext2D) {
        context.fillStyle = this.color;
        context.fillRect((this.x + 500 * 10) % 500, (this.y + 500 * 10) % 500, 20, 20);
    }


    processServerUp(message: Action, isServer: boolean = false) {
        let lastDown = this.lastDownAction[message.actionType];
        switch (message.actionType) {
            case ActionType.Left:
                this.x = lastDown.x - (message.actionTick! - lastDown.actionTick!) / 1000 * this.speedPerSecond;
                break;
            case ActionType.Right:
                this.x = lastDown.x + (message.actionTick! - lastDown.actionTick!) / 1000 * this.speedPerSecond;
                break;
            case ActionType.Up:
                this.y = lastDown.y - (message.actionTick! - lastDown.actionTick!) / 1000 * this.speedPerSecond;
                break;
            case ActionType.Down:
                this.y = lastDown.y + (message.actionTick! - lastDown.actionTick!) / 1000 * this.speedPerSecond;
                break;
        }
        delete this.lastDownAction[message.actionType];
    }

    processAction(message: Action) {
        switch (message.actionType) {
            case ActionType.Bomb:
                break;
        }
    }
}

export class Server {

    private clients: PlayerEntity[] = [];
    private startingTick: number;
    private unprocessedMessages: ServerMessage[] = [];

    get currentTick(): number {
        return +new Date() - this.startingTick;
    }

    constructor() {
        this.startingTick = +new Date();

        Socket.createServer((clientId, mesasage) => {
            this.unprocessedMessages.push(mesasage);
        }, (client) => {
            let newClient = new PlayerEntity(client.id, null!);
            newClient.x = parseInt((Math.random() * 500).toFixed());
            newClient.y = parseInt((Math.random() * 500).toFixed());
            newClient.color = "#" + ((1 << 24) * Math.random() | 0).toString(16);
            this.clients.push(newClient);
            Socket.sendToClient(client.id, {
                messageType: "start",
                yourEntityId: client.id,
                serverTick: this.currentTick,
                state: this.getWorldState()
            });
            for (let c = 0; c < this.clients.length; c++) {
                let client = this.clients[c];
                if (client !== newClient) {
                    Socket.sendToClient(client.id, {messageType: 'worldState', state: this.getWorldState()})
                }
            }

        });

        setInterval(() => {
            this.process();
        }, 100);
    }

    lastTick = this.currentTick;

    process() {
        let curTick = this.currentTick;
        for (let i = 0; i < this.unprocessedMessages.length; i++) {
            const message = this.unprocessedMessages[i];
            if (message.messageType === "action") {
                const client = this.clients.find(a => a.id === message.action.entityId);
                if (client) {
                    this.serverProcessAction(client, message.action);
                }
            }
        }

        this.unprocessedMessages.length = 0;

        for (let i = 0; i < this.clients.length; i++) {
            let client = this.clients[i];
            client.tick(curTick - this.lastTick, curTick, true);
        }
        this.lastTick = curTick;
        this.sendWorldState();
    }


    serverProcessAction(client: PlayerEntity, message: Action) {
        switch (message.actionSubType) {
            case ActionSubType.Down: {
                client.lastDownAction[message.actionType] = message;
                break;
            }
            case ActionSubType.Up: {
                client.processServerUp(message, true);
                break;
            }
            case ActionSubType.None: {
                client.processAction(message);
                break;
            }
        }
    }

    getWorldState(): WorldState {
        return {
            entities: this.clients.map(c => ({
                id: c.id,
                color: c.color,
                x: c.x,
                y: c.y,
                lastDownAction: c.lastDownAction,
            })),
            currentTick: this.currentTick
        }
    }

    sendWorldState() {
        // console.log(JSON.stringify(this.getWorldState()));
        for (let c = 0; c < this.clients.length; c++) {
            let client = this.clients[c];
            Socket.sendToClient(client.id, {messageType: 'worldState', state: this.getWorldState()})
        }
    }

    draw(context: CanvasRenderingContext2D) {
        for (let c = 0; c < this.clients.length; c++) {
            let client = this.clients[c];
            client.draw(context);
        }
    }
}

export class Here {
    static start() {
    }
}


let server = new Server();


let clients: ClientGame[] = [];
let contexts: CanvasRenderingContext2D[] = [];

for (let i = 0; i < 7; i++) {
    let client = new ClientGame();
    client.join();
    clients.push(client);
    let canvas = document.createElement("canvas");
    canvas.style.border = 'solid 2px white';
    canvas.height = canvas.width = 500;
    contexts.push(canvas.getContext('2d')!);
    document.body.appendChild(canvas)
}
let canvas = document.createElement("canvas");
canvas.style.border = 'solid 2px red';
canvas.height = canvas.width = 500;
contexts.push(canvas.getContext('2d')!);
document.body.appendChild(canvas);


let lastTick = +new Date();
setInterval(() => {
    let curTick = +new Date();
    for (let i = 0; i < clients.length; i++) {
        let client = clients[i];
        client.tick(curTick - lastTick)
    }
    lastTick = curTick;
}, 16);
setInterval(() => {
    for (let i = 0; i < clients.length; i++) {
        let client = clients[i];
        contexts[i].clearRect(0, 0, 500, 500);
        client.draw(contexts[i]);
    }
    contexts[clients.length].clearRect(0, 0, 500, 500);
    server.draw(contexts[clients.length]);
}, 16);
let clientInd = 0;
document.onkeydown = (e) => {
    if (e.ctrlKey) {
        clientInd = (clientInd + 1) % clients.length;
    }
    if (e.keyCode === 38) {
        clients[clientInd].liveEntity.pressUp();
    } else if (e.keyCode === 40) {
        clients[clientInd].liveEntity.pressDown();
    } else if (e.keyCode === 37) {
        clients[clientInd].liveEntity.pressLeft();
    } else if (e.keyCode === 39) {
        clients[clientInd].liveEntity.pressRight();
    }
};
document.onkeyup = (e) => {
    if (e.keyCode === 38) {
        clients[clientInd].liveEntity.releaseUp();
    } else if (e.keyCode === 40) {
        clients[clientInd].liveEntity.releaseDown();
    } else if (e.keyCode === 37) {
        clients[clientInd].liveEntity.releaseLeft();
    } else if (e.keyCode === 39) {
        clients[clientInd].liveEntity.releaseRight();
    }
};

false && setInterval(() => {
    for (let i = 0; i < clients.length; i++) {
        let client = clients[i];

        if (Math.random() * 1000 < 50) {
            if (client.liveEntity.pressingLeft)
                client.liveEntity.releaseLeft();
            else
                client.liveEntity.pressLeft();
        } else {
            if (Math.random() * 1000 < 50) {
                if (client.liveEntity.pressingRight)
                    client.liveEntity.releaseRight();
                else
                    client.liveEntity.pressRight();
            }
        }
        if (Math.random() * 1000 < 50) {
            if (client.liveEntity.pressingUp)
                client.liveEntity.releaseUp();
            else
                client.liveEntity.pressUp();
        } else {
            if (Math.random() * 1000 < 50) {
                if (client.liveEntity.pressingDown)
                    client.liveEntity.releaseDown();
                else
                    client.liveEntity.pressDown();
            }
        }
    }
}, 500)

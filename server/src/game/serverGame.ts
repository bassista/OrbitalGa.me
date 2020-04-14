import {ClientToServerMessage, ServerToClientMessage} from '@common/models/messages';
import {unreachable} from '@common/utils/unreachable';
import {IServerSocket} from '../serverSocket';
import {nextId} from '@common/utils/uuid';
import {GameConstants} from '@common/game/gameConstants';
import {Game} from '@common/game/game';
import {Utils} from '@common/utils/utils';
import {SwoopingEnemyEntity} from '@common/entities/swoopingEnemyEntity';
import {ServerPlayerEntity} from './entities/serverPlayerEntity';
import {SpectatorEntity} from '@common/entities/spectatorEntity';
import {EntityModels} from '@common/models/entityTypeModels';
import {PlayerShieldEntity} from '@common/entities/playerShieldEntity';
import {PlayerEntity} from '@common/entities/playerEntity';
import {MeteorEntity} from '@common/entities/meteorEntity';
import {ArrayHash} from '@common/utils/arrayHash';
import {Entity} from '@common/entities/entity';
import {RBushXOnly} from '@common/utils/rbushXOnly';
import {EntityGrouping} from './entityClusterer';
import {GameLeaderboard} from '@common/game/gameLeaderboard';

type Spectator = {connectionId: number};
type User = {
  connectionId: number;
  entity: ServerPlayerEntity;
  name: string;
};

export class ServerGame extends Game {
  entityGroupingsThisTick: EntityGrouping[] = [];
  queuedMessages: {
    connectionId: number;
    message: ClientToServerMessage;
  }[] = [];
  queuedMessagesToSend: {[connectionId: number]: ServerToClientMessage[]} = {};
  spectators = new ArrayHash<Spectator>('connectionId');
  users = new ArrayHash<User>('connectionId');

  constructor(private serverSocket: IServerSocket) {
    super(false);
    serverSocket.start({
      onJoin: (connectionId) => {
        this.queuedMessagesToSend[connectionId] = [];
      },
      onLeave: (connectionId) => {
        this.userLeave(connectionId);
      },
      onMessage: (connectionId, message) => {
        this.processMessage(connectionId, message);
      },
    });
  }

  init() {
    let serverTick = 0;
    let time = +new Date();
    let tickTime = 0;

    this.initGame();

    const processTick = () => {
      try {
        const now = +new Date();
        const duration = now - time;
        if (duration > GameConstants.serverTickRate * 1.2) {
          console.log('bad duration', duration);
        }
        time = +new Date();
        // console.time('server tick');
        const newTickTime = +new Date();
        this.serverTick(++serverTick, duration, tickTime);
        tickTime = +new Date() - newTickTime;
        // console.timeEnd('server tick');
        // console.time('gc');
        // global.gc();
        // console.timeEnd('gc');

        if (serverTick % 15 === 0) {
          this.updateSpectatorPosition();
        }

        setTimeout(() => {
          processTick();
        }, Math.max(Math.min(GameConstants.serverTickRate, GameConstants.serverTickRate - tickTime), 1));
      } catch (ex) {
        console.error(ex);
      }
    };
    setTimeout(() => {
      processTick();
    }, 1000 / 5);
  }

  processInputs() {
    const noInputThisTick = Utils.toDictionary(this.users.array, (a) => a.entity.entityId);

    const time = +new Date();
    let stopped = false;

    for (let i = 0; i < this.queuedMessages.length; i++) {
      if (time + 100 < +new Date()) {
        console.log('stopped');
        stopped = true;
        this.queuedMessages.splice(0, i);
        break;
      }
      const q = this.queuedMessages[i];
      switch (q.message.type) {
        case 'join':
          this.userJoin(q.connectionId, q.message.name);
          break;
        case 'spectate':
          this.spectatorJoin(q.connectionId);
          break;
        case 'ping':
          {
            const connection = this.serverSocket.connections.lookup(q.connectionId);
            if (connection) {
              connection.lastPing = +new Date();
            }
          }
          break;
        case 'playerInput': {
          const user = this.users.lookup(q.connectionId);
          const connection = this.serverSocket.connections.lookup(q.connectionId);
          if (user && connection) {
            connection.lastAction = +new Date();
            delete noInputThisTick[user.entity.entityId];
            /*if (Math.abs(q.message.inputSequenceNumber - user.entity.lastProcessedInputSequenceNumber) > 20) {
                console.log(
                  'User input sequence too far off',
                  q.message.inputSequenceNumber,
                  user.entity.lastProcessedInputSequenceNumber
                );
                this.serverSocket.disconnect(connection.connectionId);
              } else*/ {
              user.entity.applyInput(q.message);
            }
          }
          break;
        }
        default:
          unreachable(q.message);
      }
    }

    if (!stopped) {
      this.queuedMessages.length = 0;
    } else {
      console.log(this.queuedMessages.length, 'remaining');
    }

    for (const key in noInputThisTick) {
      noInputThisTick[key].entity.applyInput({
        down: false,
        up: false,
        right: false,
        left: false,
        shoot: false,
        weapon: noInputThisTick[key].entity.selectedWeapon,
        inputSequenceNumber: noInputThisTick[key].entity.lastProcessedInputSequenceNumber + 1,
      });
    }
  }

  processMessage(connectionId: number, message: ClientToServerMessage) {
    this.queuedMessages.push({connectionId, message});
  }

  sendMessageToClient(connectionId: number, message: ServerToClientMessage) {
    if (this.queuedMessagesToSend[connectionId]) {
      this.queuedMessagesToSend[connectionId].push(message);
    }
  }

  serverTick(tickIndex: number, duration: number, tickTime: number) {
    if (!GameConstants.singlePlayer) {
      const groupings = this.entityClusterer.getGroupings((a) => a.entityType === 'player');
      const groups = Utils.groupBy(this.entities.array, (a) => a.entityType);
      const memoryUsage = process.memoryUsage();
      console.log(
        `#${tickIndex}, Con: ${this.serverSocket.connections.length}, Usr: ${this.users.length}, Spc ${
          this.spectators.length
        }, Ents: ${this.entities.length}, Msg:${
          this.queuedMessages.length
        }, Duration: ${tickTime}ms, -> ${Utils.formatBytes(this.serverSocket.totalBytesSent)}, -> ${Utils.formatBytes(
          this.serverSocket.totalBytesSentPerSecond
        )}/s, <- ${Utils.formatBytes(this.serverSocket.totalBytesReceived)}, Wdt: ${
          groupings[groupings.length - 1].x1 - groupings[0].x0
        }, Mem:${Utils.formatBytes(memoryUsage.heapUsed)}/${Utils.formatBytes(
          memoryUsage.heapTotal
        )}/${Utils.formatBytes(memoryUsage.external)} ${Utils.safeKeys(groups)
          .map((a) => `${a}: ${groups[a].length}`)
          .join(', ')}`
      );
    }

    this.processInputs();

    for (const grouping of this.entityClusterer.getGroupings(
      (a) => a.entityType === 'player' || a.entityType === 'swoopingEnemy'
    )) {
      const enemies = grouping.entities.filter((a) => a.entityType === 'swoopingEnemy').length;
      const players = Math.ceil(Math.min(grouping.entities.filter((a) => a.entityType === 'player').length, 4) * 1.5);
      if (enemies < players) {
        for (let i = enemies; i < players; i++) {
          const swoopingEnemyEntity = new SwoopingEnemyEntity(
            this,
            nextId(),
            this.entityClusterer.getNewEnemyXPositionInGroup(grouping),
            -GameConstants.screenSize.height * 0.1 + Math.random() * GameConstants.screenSize.height * 0.15,
            SwoopingEnemyEntity.randomEnemyColor()
          );
          this.entities.push(swoopingEnemyEntity);
        }
      }
    }

    if (tickIndex === 50) {
      const groupings = this.entityClusterer.getGroupings((a) => a.entityType === 'player');
      // new BossEvent1Entity(this, nextId(), groupings[groupings.length - 1].x1 - groupings[0].x0);
    }
    if (tickIndex % 50 === 0) {
      for (const grouping of this.entityClusterer.getGroupings((a) => a.entityType === 'player')) {
        for (let i = 0; i < 10; i++) {
          const {meteorColor, type, size} = MeteorEntity.randomMeteor();
          const meteor = new MeteorEntity(
            this,
            nextId(),
            Utils.randomInRange(grouping.x0, grouping.x1),
            -GameConstants.screenSize.height * 0.1 + Math.random() * GameConstants.screenSize.height * 0.15,
            meteorColor,
            size,
            type
          );

          this.entities.push(meteor);
        }
      }
    }

    this.entityGroupingsThisTick = this.entityClusterer.getGroupings((a) => a.entityType === 'player');
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities.array[i];
      entity.gameTick(duration);
    }
    for (let i = this.entities.array.length - 1; i >= 0; i--) {
      const entity = this.entities.array[i];
      entity.updatePolygon();
    }

    this.checkCollisions();

    if (tickIndex % 10 === 0) {
      this.sendLeaderboard();
    }

    this.sendWorldState();

    for (const c of this.users.array) {
      const messages = this.queuedMessagesToSend[c.connectionId];
      if (messages && messages.length > 0) {
        this.serverSocket.sendMessage(c.connectionId, messages);
        messages.length = 0;
      }
    }

    this.sendSpectatorWorldState();

    for (const c of this.spectators.array) {
      const messages = this.queuedMessagesToSend[c.connectionId];
      if (messages && messages.length > 0) {
        this.serverSocket.sendMessage(c.connectionId, messages);
        messages.length = 0;
      }
    }

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities.getIndex(i);
      if (entity.markToDestroy) {
        this.entities.remove(entity);
      } else {
        entity.postTick();
      }
    }

    const now = +new Date();
    for (let i = this.serverSocket.connections.array.length - 1; i >= 0; i--) {
      const connection = this.serverSocket.connections.array[i];
      if (this.users.lookup(connection.connectionId)) {
        if (connection.lastAction + GameConstants.lastActionTimeout < now) {
          this.serverSocket.disconnect(connection.connectionId);
          continue;
        }
      }
      if (this.spectators.lookup(connection.connectionId)) {
        if (connection.spectatorJoin + GameConstants.totalSpectatorDuration < now) {
          this.serverSocket.disconnect(connection.connectionId);
          continue;
        }
      }
      if (connection.lastPing + GameConstants.lastPingTimeout < now) {
        this.serverSocket.disconnect(connection.connectionId);
      }
    }
  }

  spectatorJoin(connectionId: number) {
    this.spectators.push({connectionId});
    const connection = this.serverSocket.connections.lookup(connectionId);
    if (connection) {
      connection.spectatorJoin = +new Date();
    }

    this.sendMessageToClient(connectionId, {
      type: 'spectating',
      serverVersion: GameConstants.serverVersion,
    });
  }

  userJoin(connectionId: number, name: string) {
    const connection = this.serverSocket.connections.lookup(connectionId);
    if (connection) {
      connection.lastAction = +new Date();
    } else {
      // connection is already dead
      return;
    }

    const spectator = this.spectators.lookup(connectionId);
    if (spectator) {
      this.spectators.remove(spectator);
    }
    const user = this.users.lookup(connectionId);
    if (user) {
      this.userLeave(connectionId);
    }
    if (name.length > 10) {
      this.serverSocket.disconnect(connectionId);
      return;
    }
    if (this.users.filter((u) => u.name === name).length > 0) {
      this.serverSocket.sendMessage(connectionId, [
        {
          type: 'error',
          reason: 'nameInUse',
        },
      ]);
      return;
    }

    const playerEntity = new ServerPlayerEntity(this, nextId(), PlayerEntity.randomEnemyColor());
    this.gameLeaderboard.addPlayer(playerEntity.entityId);
    const startingPos = this.entityClusterer.getNewPlayerXPosition();
    playerEntity.x = startingPos;
    playerEntity.y = GameConstants.playerStartingY;
    this.users.push({name, connectionId, entity: playerEntity});
    this.entities.push(playerEntity);

    const playerShieldEntity = new PlayerShieldEntity(this, nextId(), playerEntity.entityId, 'small');
    this.entities.push(playerShieldEntity);
    playerEntity.setShieldEntity(playerShieldEntity.entityId);

    this.sendMessageToClient(connectionId, {
      type: 'joined',
      ...playerEntity.serializeLive(),
      serverVersion: GameConstants.serverVersion,
    });
  }

  userLeave(connectionId: number) {
    const spectator = this.spectators.lookup(connectionId);
    if (spectator) {
      this.spectators.remove(spectator);
    }
    const user = this.users.lookup(connectionId);
    if (!user) {
      delete this.queuedMessagesToSend[connectionId];
      return;
    }
    user.entity.die();
    this.users.remove(user);
    delete this.queuedMessagesToSend[connectionId];
  }

  private initGame() {
    this.entities.push(new SpectatorEntity(this, nextId()));
    this.updateSpectatorPosition();
  }

  private sendLeaderboard() {
    if (this.users.array.length === 0 && this.spectators.array.length === 0) return;

    const scores = this.gameLeaderboard.updateScores();
    for (const score of scores) {
      score.username = this.users.array.find((a) => a.entity.entityId === score.userId)?.name ?? '';
    }

    const topTen = [...scores].slice(0, 10);
    for (const user of this.users.array) {
      if (!user.entity) {
        continue;
      }

      if (topTen.find((a) => a.userId === user.entity.entityId)) {
        this.sendMessageToClient(user.connectionId, {
          type: 'leaderboard',
          scores: topTen,
        });
      } else {
        const myScore = scores.find((a) => a.userId === user.entity.entityId)!;
        if (myScore) {
          this.sendMessageToClient(user.connectionId, {
            type: 'leaderboard',
            scores: [...topTen, myScore],
          });
        }
      }
    }

    for (const c of this.spectators.array) {
      this.serverSocket.sendMessage(c.connectionId, [
        {
          type: 'leaderboard',
          scores: topTen,
        },
      ]);
    }
  }

  private sendSpectatorWorldState() {
    const spectator = this.entities.array.find((a) => a instanceof SpectatorEntity);
    if (!spectator) {
      return;
    }
    const box = {
      x0: spectator.x - GameConstants.screenRange / 2,
      x1: spectator.x + GameConstants.screenRange / 2,
    };

    const myEntities = this.entities.map((entity) => ({
      entity,
      serializedEntity: entity.serialize() as EntityModels,
    }));

    if (!GameConstants.debugDontFilterEntities) {
      for (let i = myEntities.length - 1; i >= 0; i--) {
        const myEntity = myEntities[i];
        const x = myEntity.entity.realX;
        if (x < box.x0 || x > box.x1) {
          myEntities.splice(i, 1);
        }
      }
    }

    for (const c of this.spectators.array) {
      this.serverSocket.sendMessage(c.connectionId, [
        {
          type: 'worldState',
          entities: myEntities.map((a) => a.serializedEntity),
        },
      ]);
    }
  }

  private sendWorldState() {
    if (this.users.array.length === 0) return;

    const bush = new RBushXOnly<{entity: Entity; serializedEntity: EntityModels}>();

    for (const entity of this.entities.array) {
      bush.insert({
        maxX: entity.realX,
        minX: entity.realX,
        item: {
          entity,
          serializedEntity: entity.serialize() as EntityModels,
        },
        children: undefined!,
        height: undefined!,
      });
    }

    for (const user of this.users.array) {
      if (!user.entity) {
        continue;
      }

      const items = bush.search({
        minX: user.entity.realX - GameConstants.screenRange / 2,
        maxX: user.entity.realX + GameConstants.screenRange / 2,
      });

      const myEntities: typeof bush.data.item[] = [];
      myEntities.push({
        entity: user.entity,
        serializedEntity: user.entity.serializeLive(),
      });

      if (!GameConstants.debugDontFilterEntities) {
        for (const entity of items) {
          if (entity.item.entity !== user.entity) {
            myEntities.push(entity.item);
          }
        }
      }

      this.sendMessageToClient(user.connectionId, {
        type: 'worldState',
        entities: myEntities.map((a) => a.serializedEntity),
      });
    }
  }

  private updateSpectatorPosition() {
    const range = this.getPlayerRange(0, (e) => e.y > 30);
    const spectator = this.entities.array.find((a) => a instanceof SpectatorEntity);
    if (!spectator) {
      return;
    }
    spectator.x = range.x0 + Math.random() * (range.x1 - range.x0);
    spectator.y = 0;
  }
}

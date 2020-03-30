import {ClientGame} from '../../client/clientGame';
import {Utils} from '../../utils/utils';
import {Game} from '../game';
import {PlayerEntityOptions} from '../types';
import {PlayerEntity} from './playerEntity';
import {ShotEntity} from './shotEntity';

export class LivePlayerEntity extends PlayerEntity {
  private lastSendActionTime: number = 0;
  private lastActionChanged: boolean;
  constructor(game: ClientGame, options: PlayerEntityOptions) {
    super(game, options);
  }

  game: ClientGame;

  pressingLeft = false;
  pressingRight = false;

  pressingShoot = false;

  pressingUp = false;
  pressingDown = false;

  pressLeft() {
    if (this.pressingRight) {
      return;
    }
    this.pressingLeft = true;
  }

  pressRight() {
    if (this.pressingLeft) {
      return;
    }
    this.pressingRight = true;
  }

  releaseLeft() {
    this.pressingLeft = false;
  }

  releaseRight() {
    this.pressingRight = false;
  }

  pressUp() {
    if (this.pressingDown) {
      return;
    }
    this.pressingUp = true;
  }

  pressDown() {
    if (this.pressingUp) {
      return;
    }
    this.pressingDown = true;
  }

  releaseUp() {
    this.pressingUp = false;
  }

  releaseDown() {
    this.pressingDown = false;
  }

  pressShoot() {
    this.pressingShoot = true;
  }

  releaseShoot() {
    this.pressingShoot = false;
  }

  tick(timeSinceLastTick: number, timeSinceLastServerTick: number, currentServerTick: number) {
    const [actionSub2, actionSub1] = this.bufferedActions.slice(-2);
    if (!actionSub1) {
      return;
    }
    this.x = actionSub2.x + (actionSub1.x - actionSub2.x) * ((+new Date() - this.lastSendActionTime) / Game.tickRate);
    this.y = actionSub2.y + (actionSub1.y - actionSub2.y) * ((+new Date() - this.lastSendActionTime) / Game.tickRate);
  }

  lockTick(currentServerTick: number): void {
    const controls = {
      left: false,
      right: false,
      down: false,
      up: false,
      shoot: false,
    };

    let change = false;

    if (this.pressingLeft) {
      change = true;
      controls.left = true;
    }
    if (this.pressingRight) {
      change = true;
      controls.right = true;
    }
    if (this.pressingUp) {
      change = true;
      controls.up = true;
    }
    if (this.pressingDown) {
      change = true;
      controls.down = true;
    }
    if (this.pressingShoot) {
      change = true;
      controls.shoot = true;
    }

    const action = {
      controls,
      x: this.latestAction.x,
      y: this.latestAction.y,
      entityId: this.id,
      actionTick: currentServerTick,
    };

    if (change || this.lastActionChanged) {
      this.lastActionChanged = change;

      this.game.sendAction({...action});

      this.processAction(action);
      this.addAction(action);
    } else {
      this.lastActionChanged = false;
    }
    this.lastSendActionTime = +new Date();
  }
}
import {Result} from 'collisions';
import {Game} from '../game/game';
import {Entity, EntityModel} from './entity';
import {GameConstants} from '../game/gameConstants';
import {ShotEntity} from './shotEntity';
import {nextId} from '../utils/uuid';
import {ArrayBufferBuilder, ArrayBufferReader} from '../parsers/arrayBufferBuilder';
import {WallEntity} from './wallEntity';
import {ExplosionEntity} from './explosionEntity';
import {PlayerShieldEntity} from './playerShieldEntity';
import {GameRules} from '../game/gameRules';
import {Utils} from '../utils/utils';
import {RocketEntity} from './rocketEntity';
import {isEnemyWeapon, Weapon} from './weapon';

export type PlayerInput = {
  down: boolean;
  inputSequenceNumber: number;
  left: boolean;
  right: boolean;
  shoot: boolean;
  up: boolean;
  weapon: PlayerWeapon;
};

export type PlayerColor = 'blue' | 'green' | 'orange' | 'red';
export type PlayerWeapon = 'none' | 'rocket' | 'laser';
export const AllPlayerWeapons: PlayerWeapon[] = ['rocket', 'laser', 'rocket'];
export type AvailableWeapon = {ammo: number; weapon: PlayerWeapon};

export class PlayerEntity extends Entity implements Weapon {
  aliveTick = 0;
  availableWeapons: AvailableWeapon[] = [
    {ammo: 100, weapon: 'rocket'},
    {ammo: 100, weapon: 'laser'},
  ];
  boundingBoxes = [{width: 99, height: 75}];
  damage = 2;
  dead: boolean = false;
  explosionIntensity = 2;
  health = GameRules.player.base.startingHealth;
  inputSequenceNumber: number = 1;
  isWeapon = true as const;
  lastProcessedInputSequenceNumber: number = 0;
  momentumX = 0;
  momentumY = 0;
  pendingInputs: PlayerInput[] = [];
  selectedWeapon: PlayerWeapon | 'none' = 'none';
  shootTimer: number = 1;
  shotSide: 'left' | 'right' = 'left';
  weaponSide = 'player' as const;
  xInputsThisTick: boolean = false;
  yInputsThisTick: boolean = false;

  private shieldEntityId?: number;

  constructor(game: Game, entityId: number, public playerColor: PlayerColor) {
    super(game, entityId, 'player');
    this.createPolygon();
  }

  get realX() {
    return this.x;
  }

  get realY() {
    return this.y;
  }

  applyInput(input: PlayerInput) {
    this.aliveTick++;
    this.xInputsThisTick = false;
    this.yInputsThisTick = false;
    this.selectedWeapon = input.weapon;
    if (input.shoot) {
      if (!this.game.isClient) {
        if (this.shootTimer <= 0) {
          if (this.selectedWeapon === 'rocket') {
            const shotEntity = new RocketEntity(this.game, nextId(), this.entityId, 0, this.y - 6);
            shotEntity.start(this.x, this.y - 6);
            this.game.entities.push(shotEntity);
          } else {
            const offsetX = this.shotSide === 'left' ? -42 : 42;
            const shotEntity = new ShotEntity(this.game, nextId(), this.entityId, offsetX, this.y - 6);
            shotEntity.start(this.x + offsetX, this.y - 6);
            this.game.entities.push(shotEntity);
            this.shotSide = this.shotSide === 'left' ? 'right' : 'left';
          }
          this.shootTimer = 1;
        }
      }
    }

    const ramp = 30;
    if (input.left) {
      this.xInputsThisTick = true;
      this.momentumX -= ramp;
      if (this.momentumX < -GameRules.player.base.maxSpeed) {
        this.momentumX = -GameRules.player.base.maxSpeed;
      }
    }
    if (input.right) {
      this.xInputsThisTick = true;
      this.momentumX += ramp;
      if (this.momentumX > GameRules.player.base.maxSpeed) {
        this.momentumX = GameRules.player.base.maxSpeed;
      }
    }
    if (input.up) {
      this.yInputsThisTick = true;
      this.momentumY -= ramp;
      if (this.momentumY < -GameRules.player.base.maxSpeed) {
        this.momentumY = -GameRules.player.base.maxSpeed;
      }
    }
    if (input.down) {
      this.yInputsThisTick = true;
      this.momentumY += ramp;
      if (this.momentumY > GameRules.player.base.maxSpeed) {
        this.momentumY = GameRules.player.base.maxSpeed;
      }
    }
  }

  collide(otherEntity: Entity, collisionResult: Result): boolean {
    if (otherEntity instanceof WallEntity) {
      this.x -= collisionResult.overlap * collisionResult.overlap_x;
      this.y -= collisionResult.overlap * collisionResult.overlap_y;
      this.updatePolygon();
      return true;
    }

    if (!this.game.isClient) {
      if (isEnemyWeapon(otherEntity)) {
        otherEntity.hurt(
          otherEntity.damage,
          this,
          collisionResult.overlap * collisionResult.overlap_x,
          collisionResult.overlap * collisionResult.overlap_y
        );
        this.hurt(
          otherEntity.damage,
          otherEntity,
          -collisionResult.overlap * collisionResult.overlap_x,
          -collisionResult.overlap * collisionResult.overlap_y
        );

        return true;
      }
    }
    return false;
  }

  gameTick(): void {
    this.shootTimer = Math.max(this.shootTimer - 1, 0);
    this.updatedPositionFromMomentum();

    if (!this.game.isClient) {
      if (this.health <= 0) {
        this.dead = true;
        if (this.shieldEntityId) this.game.entities.lookup(this.shieldEntityId).destroy();
        this.game.explode(this, 'big');
      }
    }
  }

  hurt(damage: number, otherEntity: Entity, x: number, y: number) {
    const shield = this.game.entities.lookup<PlayerShieldEntity>(this.shieldEntityId!);
    this.momentumX += x;
    this.momentumY += y;
    if (!shield.depleted) {
      const damageLeft = shield.hurt(damage, otherEntity, x, y);
      if (damageLeft === 0) {
        return;
      } else {
        damage = damageLeft;
      }
    }

    this.health -= damage;
    const explosionEntity = new ExplosionEntity(this.game, nextId(), this.explosionIntensity, this.entityId);
    explosionEntity.start(x, y);
    this.game.entities.push(explosionEntity);
  }

  reconcileDataFromServer(messageModel: PlayerModel) {
    // needed because LivePlayerEntity does not need the pending inputs from super.reconcile
    this.health = messageModel.health;
    this.dead = messageModel.dead;
    this.playerColor = messageModel.playerColor;
    this.lastProcessedInputSequenceNumber = messageModel.lastProcessedInputSequenceNumber;
    this.momentumX = messageModel.momentumX;
    this.momentumY = messageModel.momentumY;
    this.availableWeapons = messageModel.availableWeapons;
    this.selectedWeapon = messageModel.selectedWeapon;
  }

  reconcileFromServer(messageModel: PlayerModel) {
    super.reconcileFromServer(messageModel);
    this.reconcileDataFromServer(messageModel);
  }

  serialize(): PlayerModel {
    return {
      ...super.serialize(),
      momentumX: this.momentumX,
      momentumY: this.momentumY,
      lastProcessedInputSequenceNumber: this.lastProcessedInputSequenceNumber,
      health: this.health,
      dead: this.dead,
      playerColor: this.playerColor,
      entityType: 'player',
      selectedWeapon: this.selectedWeapon,
      availableWeapons: this.availableWeapons.map((w) => ({weapon: w.weapon, ammo: w.ammo})),
    };
  }

  setShieldEntity(shieldEntityId: number) {
    this.shieldEntityId = shieldEntityId;
  }

  updatedPositionFromMomentum() {
    this.x += this.momentumX;
    this.y += this.momentumY;

    if (!this.xInputsThisTick) {
      this.momentumX = this.momentumX * GameRules.player.base.momentumDeceleration;
    }
    if (!this.yInputsThisTick) {
      this.momentumY = this.momentumY * GameRules.player.base.momentumDeceleration;
    }
    if (Math.abs(this.momentumX) < 3) {
      this.momentumX = 0;
    }
    if (Math.abs(this.momentumY) < 3) {
      this.momentumY = 0;
    }

    const {x0, x1} = this.game.getPlayerRange(1000, (entity) => this !== entity);
    if (this.x < x0) {
      this.x = x0;
      this.momentumX = 0;
    }
    if (this.x > x1) {
      this.x = x1;
      this.momentumX = 0;
    }

    if (this.y < GameConstants.screenSize.height * 0.1) {
      this.y = GameConstants.screenSize.height * 0.1;
      this.momentumY = 0;
    }
    if (this.y > GameConstants.screenSize.height * 1.1) {
      this.y = GameConstants.screenSize.height * 1.1;
      this.momentumY = 0;
    }
  }

  static addBuffer(buff: ArrayBufferBuilder, entity: PlayerModel) {
    Entity.addBuffer(buff, entity);
    buff.addFloat32(entity.momentumX);
    buff.addFloat32(entity.momentumY);
    buff.addUint8(entity.health);
    buff.addBoolean(entity.dead);
    buff.addUint32(entity.lastProcessedInputSequenceNumber);
    buff.addUint8(
      Utils.switchType(entity.playerColor, {
        blue: 1,
        green: 2,
        orange: 3,
        red: 4,
      })
    );
    buff.addUint8(
      Utils.switchType(entity.selectedWeapon, {
        none: 1,
        rocket: 2,
        laser: 3,
      })
    );
    buff.addUint8(entity.availableWeapons.length);
    for (const availableWeapon of entity.availableWeapons) {
      PlayerEntity.addBufferWeapon(buff, availableWeapon.weapon);
      buff.addUint16(availableWeapon.ammo);
    }
  }

  static addBufferWeapon(buff: ArrayBufferBuilder, weapon: PlayerWeapon) {
    buff.addUint8(
      Utils.switchType(weapon, {
        none: 1,
        rocket: 2,
        laser: 3,
      })
    );
  }

  static randomEnemyColor() {
    return Utils.randomElement(['blue' as const, 'green' as const, 'orange' as const, 'red' as const]);
  }

  static readBuffer(reader: ArrayBufferReader): PlayerModel {
    return {
      ...Entity.readBuffer(reader),
      entityType: 'player',
      momentumX: reader.readFloat32(),
      momentumY: reader.readFloat32(),
      health: reader.readUint8(),
      dead: reader.readBoolean(),
      lastProcessedInputSequenceNumber: reader.readUint32(),
      playerColor: Utils.switchNumber(reader.readUint8(), {
        1: 'blue' as const,
        2: 'green' as const,
        3: 'orange' as const,
        4: 'red' as const,
      }),
      selectedWeapon: PlayerEntity.readBufferWeapon(reader),
      availableWeapons: reader.loop(
        () => ({
          weapon: PlayerEntity.readBufferWeapon(reader),
          ammo: reader.readUint16(),
        }),
        '8'
      ),
    };
  }

  static readBufferWeapon(reader: ArrayBufferReader): PlayerWeapon {
    return Utils.switchNumber(reader.readUint8(), {
      1: 'none' as const,
      2: 'rocket' as const,
      3: 'laser' as const,
    });
  }
}

export type PlayerModel = EntityModel & {
  availableWeapons: {ammo: number; weapon: PlayerWeapon}[];
  dead: boolean;
  entityType: 'player';
  health: number;
  lastProcessedInputSequenceNumber: number;
  momentumX: number;
  momentumY: number;
  playerColor: PlayerColor;
  selectedWeapon: PlayerWeapon | 'none';
};

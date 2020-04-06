import {Result} from 'collisions';
import {Game} from '../game/game';
import {Entity, EntityModel} from './entity';
import {ArrayBufferBuilder, ArrayBufferReader} from '../parsers/arrayBufferBuilder';

export class ShotExplosionEntity extends Entity {
  get realX() {
    return this.x + (this.game.entities.lookup(this.ownerEntityId)?.x ?? 0);
  }
  get realY() {
    return this.y + (this.game.entities.lookup(this.ownerEntityId)?.y ?? 0);
  }

  constructor(game: Game, entityId: number, public ownerEntityId: number) {
    super(game, entityId, 'shotExplosion');
    this.createPolygon();
  }

  collide(otherEntity: Entity, collisionResult: Result): boolean {
    return false;
  }

  static totalAliveDuration = 5;
  aliveDuration = ShotExplosionEntity.totalAliveDuration;
  gameTick(duration: number) {
    this.aliveDuration -= 1;
    if (this.aliveDuration <= 0) {
      this.game.destroyEntity(this);
    }
  }
  serialize(): ShotExplosionModel {
    return {
      ...super.serialize(),
      realX: this.realX,
      realY: this.realY,
      aliveDuration: this.aliveDuration,
      ownerEntityId: this.ownerEntityId,
      entityType: 'shotExplosion',
    };
  }
  reconcileFromServer(messageEntity: ShotExplosionModel) {
    super.reconcileFromServer(messageEntity);
    this.aliveDuration = messageEntity.aliveDuration;
    this.ownerEntityId = messageEntity.ownerEntityId;
  }

  static readBuffer(reader: ArrayBufferReader): ShotExplosionModel {
    return {
      ...Entity.readBuffer(reader),
      entityType: 'shotExplosion',
      aliveDuration: reader.readUint8(),
      ownerEntityId: reader.readUint32(),
    };
  }

  static addBuffer(buff: ArrayBufferBuilder, entity: ShotExplosionModel) {
    Entity.addBuffer(buff, entity);
    buff.addUint8(entity.aliveDuration);
    buff.addUint32(entity.ownerEntityId);
  }
}

export type ShotExplosionModel = EntityModel & {
  entityType: 'shotExplosion';
  aliveDuration: number;
  ownerEntityId: number;
};

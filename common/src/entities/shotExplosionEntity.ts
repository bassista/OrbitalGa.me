import {Result} from 'collisions';
import {Game} from '../game/game';
import {Entity, EntityModel} from './entity';
import {ArrayBufferBuilder, ArrayBufferReader} from '../parsers/arrayBufferBuilder';

export class ShotExplosionEntity extends Entity {
  boundingBox = {width: 0, height: 0};

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

  static readBuffer(reader: ArrayBufferReader) {
    return {
      entityType: 'shotExplosion' as const,
      x: reader.readFloat32(),
      y: reader.readFloat32(),
      aliveDuration: reader.readUint8(),
      entityId: reader.readUint32(),
      ownerEntityId: reader.readUint32(),
      create: reader.readBoolean(),
    };
  }

  static addBuffer(buff: ArrayBufferBuilder, entity: ShotExplosionModel) {
    buff.addFloat32(entity.x);
    buff.addFloat32(entity.y);
    buff.addUint8(entity.aliveDuration);
    buff.addUint32(entity.entityId);
    buff.addUint32(entity.ownerEntityId);
    buff.addBoolean(entity.create);
  }
}

export type ShotExplosionModel = EntityModel & {
  entityType: 'shotExplosion';
  aliveDuration: number;
  ownerEntityId: number;
};
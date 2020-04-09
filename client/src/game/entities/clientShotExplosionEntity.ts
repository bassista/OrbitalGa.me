import {ExplosionEntity, ShotExplosionModel} from '@common/entities/explosionEntity';
import {ClientEntity, DrawZIndex} from './clientEntity';
import {ClientGame} from '../clientGame';
import {GameConstants} from '@common/game/gameConstants';
import {ShakeGame} from '../../utils/shakeUtils';
import {Entity} from '@common/entities/entity';
import {Utils} from '@common/utils/utils';
import {OrbitalAssets} from '../../utils/assetManager';

export class ClientShotExplosionEntity extends ExplosionEntity implements ClientEntity {
  rotate = Math.random() * 360;

  zIndex = DrawZIndex.Effect;

  constructor(game: ClientGame, messageEntity: ShotExplosionModel) {
    super(game, messageEntity.entityId, messageEntity.intensity, messageEntity.ownerEntityId);
    this.x = messageEntity.x;
    this.y = messageEntity.y;
    if (messageEntity.create) {
      this.positionBuffer.push({
        time: +new Date() - GameConstants.serverTickRate,
        x: this.x,
        y: this.y,
      });
      ShakeGame(messageEntity.intensity);
    }
    this.updatePolygon();
  }
  get drawX() {
    const owner = this.ownerEntityId && this.game.entities.lookup<Entity & ClientEntity>(this.ownerEntityId);
    if (!owner) {
      return this.x;
    }
    return this.x + owner.drawX;
  }
  get drawY() {
    const owner = this.ownerEntityId && this.game.entities.lookup<Entity & ClientEntity>(this.ownerEntityId);
    if (!owner) {
      return this.y;
    }
    return this.y + owner.drawY;
  }
  draw(context: CanvasRenderingContext2D): void {
    const blueExplosion = OrbitalAssets.assets['Lasers.laserBlue10'];
    context.save();
    context.translate(this.drawX, this.drawY);
    context.rotate(Utils.degToRad(this.rotate * 4));
    context.drawImage(blueExplosion.image, -blueExplosion.size.width / 2, -blueExplosion.size.height / 2);
    context.restore();
  }
  tick() {
    this.rotate++;
  }
}

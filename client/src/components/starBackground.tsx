import React, {useEffect, useRef} from 'react';
import {useAnimationFrame} from '../hooks/useAnimationFrame';
import {GameData} from '../game/gameData';
import {AssetManager} from '../utils/assetManager';
import {GameConstants} from '@common/game/gameConstants';

export const StarBackground: React.FC = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);
  useEffect(() => {
    if (!canvas.current) return;
  }, [canvas]);

  useAnimationFrame(() => {
    if (!canvas.current) return;
    const context = canvas.current.getContext('2d')!;
    context.fillStyle = '#000022';
    context.fillRect(0, 0, canvas.current.width, canvas.current.height);
    frame.current++;
    context.save();

    const view = GameData.instance.view;

    const outerBox = view.outerViewBox;
    const box = view.viewBox;
    context.scale(view.scale, view.scale);
    context.translate(-box.x, -box.y);

    context.translate(0, frame.current / 2);

    const viewY = view.viewY - frame.current / 2;
    let count = 0;
    for (let x = view.viewX - (view.viewX % 256) - 256; x < view.viewX + view.viewWidth + 256 * 2; x += 256) {
      for (let y = viewY - (viewY % 256) - 256; y < viewY + view.viewHeight + 256 * 2; y += 256) {
        context.drawImage(AssetManager.assets.stars.image, x, y);
        count++;
      }
    }

    context.restore();
  });

  return (
    <canvas
      style={{position: 'absolute', zIndex: -100, width: '100vw', height: '100vh'}}
      ref={canvas}
      width={GameConstants.screenSize.width}
      height={GameConstants.screenSize.height}
    />
  );
};
const cache = new Map();

export function getImage(src) {
  if (!src) return null;
  let entry = cache.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, w: 0, h: 0, error: false };
    img.onload = () => {
      entry.ready = true;
      entry.w = img.naturalWidth || img.width;
      entry.h = img.naturalHeight || img.height;
    };
    img.onerror = () => {
      entry.error = true;
    };
    img.src = src;
    cache.set(src, entry);
  }
  return entry;
}

export function spritePixelSize(sprite, entry) {
  const w = (entry && entry.w) || sprite.width || 100;
  const h = (entry && entry.h) || sprite.height || 100;
  return {
    w: w * (sprite.scale || 0.01),
    h: h * (sprite.scale || 0.01),
  };
}

export function drawSprite(ctx, sprite, world, cam, view) {
  const entry = getImage(sprite.src);
  if (!entry || !entry.ready) return;
  const part = world.parts.get(sprite.target);
  const frame = world.partFrame(part);
  if (!frame) return;
  const iw = entry.w || sprite.width || 100;
  const ih = entry.h || sprite.height || 100;
  const s = sprite.scale || 0.01;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, sprite.opacity ?? 1));
  if (sprite.rotate) {
    const p = cam.toScreen(frame.pos, view.w, view.h);
    ctx.translate(p.x, p.y);
    ctx.rotate(frame.angle - (sprite.baseAngle || 0) + (sprite.angle || 0));
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(sprite.offsetX || 0, sprite.offsetY || 0);
  } else {
    const p = cam.toScreen(
      { x: frame.pos.x + (sprite.offsetX || 0), y: frame.pos.y + (sprite.offsetY || 0) },
      view.w,
      view.h,
    );
    ctx.translate(p.x, p.y);
    ctx.rotate(sprite.angle || 0);
    ctx.scale(cam.scale, cam.scale);
  }
  ctx.scale(s, s);
  ctx.drawImage(entry.img, -(sprite.anchorX ?? 0.5) * iw, -(sprite.anchorY ?? 0.5) * ih, iw, ih);
  ctx.restore();
}

export function clearImageCache() {
  cache.clear();
}

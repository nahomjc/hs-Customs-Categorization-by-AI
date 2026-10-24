/**
 * Pure geometry for the small route map on each shipment card. The map shows
 * the world map cropped to the origin country and Ethiopia (the destination of
 * every case), so each card is readable without drawing a whole world.
 */

export const WORLD_MAP_W = 1000;
export const WORLD_MAP_H = 440;
/** Card map width / height. Fixed so cards never change height. */
export const CARD_MAP_ASPECT = 2.4;

export type MapPoint = { x: number; y: number };
export type MapViewBox = { x: number; y: number; w: number; h: number };

/** Quadratic arc bowed upwards, plus the curve's highest point. */
export function routeArc(
  from: MapPoint,
  to: MapPoint,
): { d: string; apexY: number; control: MapPoint } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist < 14) return null;
  const control = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 - dist * 0.22,
  };
  const apexY = 0.25 * from.y + 0.5 * control.y + 0.25 * to.y;
  const f = (n: number) => n.toFixed(1);
  return {
    d: `M ${f(from.x)} ${f(from.y)} Q ${f(control.x)} ${f(control.y)} ${f(to.x)} ${f(to.y)}`,
    apexY,
    control,
  };
}

/**
 * ViewBox that frames the destination, the origin and the arc between them,
 * with padding, at a fixed aspect ratio, kept inside the world map.
 */
export function routeViewBox(
  origin: MapPoint | null,
  destination: MapPoint,
  options: { aspect?: number; width?: number; height?: number } = {},
): MapViewBox {
  const aspect = options.aspect ?? CARD_MAP_ASPECT;
  const W = options.width ?? WORLD_MAP_W;
  const H = options.height ?? WORLD_MAP_H;

  const arc = origin ? routeArc(origin, destination) : null;
  const xs = [destination.x];
  const ys = [destination.y];
  if (origin) {
    xs.push(origin.x);
    ys.push(origin.y);
  }
  if (arc) ys.push(arc.apexY);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const pad = Math.max(55, Math.max(spanX, spanY * aspect) * 0.22);

  let w = Math.max(spanX + 2 * pad, 260);
  let h = w / aspect;
  if (h < spanY + 2 * pad) {
    h = spanY + 2 * pad;
    w = h * aspect;
  }
  if (w > W) {
    w = W;
    h = w / aspect;
  }
  if (h > H) {
    h = H;
    w = h * aspect;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = Math.min(Math.max(cx - w / 2, 0), W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), H - h);
  return { x, y, w, h };
}

export function formatViewBox(v: MapViewBox): string {
  return `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`;
}
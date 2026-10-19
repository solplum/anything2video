export type Point = [number, number];
export type Transform = ((p: Point) => Point) & {scale: number};
export type Shape = {polys: Point[][]; lines: Point[][]; path: Path2D; bbox: number[]};
export interface Ink {
  group(name: string): this;
  schedule(group: string, startSeconds: number, endSeconds: number): this;
  build(): this;
  draw(ctx: CanvasRenderingContext2D, seconds: number): unknown;
}
export const B: {
  Ink: new () => Ink;
  xf(x?: number, y?: number, scale?: number, rotation?: number): Transform;
  RNG(seed?: number): () => number;
  shape(d: string, at?: Transform): Shape;
  stroke(ink: Ink, points: Point[], width?: number, options?: Record<string, unknown>): void;
};
export function engraveShape(d: string | Shape, options?: {
  at?: Transform; light?: Point; spacing?: number; wMax?: number; outlineW?: number;
  style?: 'hatch' | 'contour'; angle?: number; ink?: Ink; g?: string; base?: number; seed?: number;
}): {ink: Ink; shape: Shape; tone: (x: number, y: number) => number};

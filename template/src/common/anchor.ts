import {ANCHOR_FRAMES} from './anchors';

const lookup = (id: string, table: Record<string, number>): number => {
  if (!Object.prototype.hasOwnProperty.call(table, id)) {
    throw new Error(`Unknown anchor id: ${id}`);
  }
  const value = table[id];
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid frame for anchor id: ${id}`);
  }
  return value;
};

/** 创建绑定到指定锚点表的查询器（默认使用生成的 ANCHOR_FRAMES）。 */
export function createAnchorLookup(table: Record<string, number> = ANCHOR_FRAMES) {
  const at = (id: string, offset = 0): number => {
    if (!Number.isFinite(offset)) throw new Error(`Invalid anchor offset for ${id}`);
    return lookup(id, table) + offset;
  };
  const span = (fromId: string, toId: string): {from: number; to: number} => {
    const from = at(fromId);
    const endKey = `${toId}.end`;
    const to = Object.prototype.hasOwnProperty.call(table, endKey) ? lookup(endKey, table) : at(toId);
    if (to < from) throw new Error(`Invalid anchor span ${fromId}..${toId}: ${from} > ${to}`);
    return {from, to};
  };
  const local = (id: string, shotFrom: number, offset = 0): number => {
    if (!Number.isFinite(shotFrom)) throw new Error(`Invalid shotFrom for anchor ${id}`);
    return at(id, offset) - shotFrom;
  };
  const secOf = (id: string, fps: number, offset = 0): number => {
    if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid fps for secOf(${id})`);
    return (at(id, offset) - 1) / fps;
  };
  return {at, span, local, secOf};
}

const defaultLookup = createAnchorLookup();
export const at = defaultLookup.at;
export const span = defaultLookup.span;
export const local = defaultLookup.local;
export const secOf = defaultLookup.secOf;

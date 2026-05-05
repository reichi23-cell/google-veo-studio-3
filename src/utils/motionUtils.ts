/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Keyframe } from '../types';

export const getInterpolatedValue = (keyframes: Keyframe[] | undefined, baseValue: number, clipTime: number): number => {
  if (!keyframes || keyframes.length === 0) return baseValue;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const nextIdx = sorted.findIndex(kf => kf.time > clipTime);
  if (nextIdx === 0) return sorted[0].value;
  if (nextIdx === -1) return sorted[sorted.length - 1].value;
  const prev = sorted[nextIdx - 1];
  const next = sorted[nextIdx];
  const t = (clipTime - prev.time) / (next.time - prev.time);
  return prev.value + (next.value - prev.value) * t;
};

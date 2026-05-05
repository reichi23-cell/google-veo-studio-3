/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Asset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  duration: number;
  thumbnail?: string;
  isLocal?: boolean;
  isGenerated?: boolean;
  styleId?: string;
  styleIntensity?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  path?: string; // Local file path for Electron persistence
}

export interface Keyframe {
  time: number;
  value: number;
}

export interface Scene {
  id: string;
  prompt: string;
  isLinked: boolean;
  status: 'idle' | 'generating' | 'completed' | 'error';
  isAnalyzing?: boolean;
  resultVideo?: string;
  thumbnail?: string;
  sourceImage?: string;
  isStructured?: boolean;
  lastFrameCaptured?: boolean;
  directorNote?: string;
  storyboardUrl?: string;
  intent?: string;
  promptParts?: {
    subject: string;
    action: string;
    camera: string;
    style: string;
  };
}

export interface HistoryItem {
  id: string;
  name: string;
  timestamp: string;
  prompt: string;
  resultUrl: string;
  duration: number;
  thumbnail?: string;
  type: 'video' | 'audio' | 'image' | 'export';
  isGenerated?: boolean;
  styleId?: string;
  styleIntensity?: number;
}

export interface VideoClip {
  id: string;
  assetId: string;
  name: string;
  type: 'video' | 'text' | 'audio' | 'image';
  url?: string;
  thumbnail?: string;
  text?: string;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  track: number;
  speed: number;
  volume: number;
  opacity: number;
  scale: number;
  rotation: number;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  keyframes?: {
    opacity?: Keyframe[];
    scale?: Keyframe[];
    x?: Keyframe[];
    y?: Keyframe[];
    rotation?: Keyframe[];
    volume?: Keyframe[];
    brightness?: Keyframe[];
    contrast?: Keyframe[];
    saturation?: Keyframe[];
    temperature?: Keyframe[];
    tint?: Keyframe[];
  };
  effects?: {
    brightness: number;
    contrast: number;
    saturation: number;
    blur: number;
    sepia: number;
    grayscale: number;
    hueRotate: number;
    temperature?: number; // -100 to 100 (Cool to Warm)
    tint?: number; // -100 to 100 (Green to Magenta)
  };
  temperature?: number;
  tint?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  groupId?: string;
  reverse?: boolean;
  linkedId?: string; // Additional field for audio linking feature
  isLocked?: boolean; // Additional field for audio linking feature
  path?: string; // Local file path for Electron persistence
}

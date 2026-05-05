/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

export async function translateToEnglish(text: string, ai: GoogleGenAI): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the following video prompt to descriptive English. High quality, detailed: "${text}"`,
  });
  return response.text?.trim() || text;
}

export async function processImageTo16x9(imageUrl: string, aspectRatio: number): Promise<string> {
  // Simple proxy or canvas resize if needed, but for now just returns the URL
  // Real implementation would use a canvas to crop/resize
  return imageUrl;
}

export async function generateShotPlan(prompt: string, ai: GoogleGenAI): Promise<any> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following theme, create a 3-shot cinematic plan: "${prompt}". Return as JSON.`,
    config: { responseMimeType: "application/json" }
  });
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
}

export async function suggestBridgePrompt(startFrame: string, endFrame: string, ai: GoogleGenAI): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { text: "Analyze these two frames and suggest a creative transition prompt to bridge them. Be descriptive." },
      { inlineData: { data: startFrame.split(',')[1], mimeType: "image/jpeg" } },
      { inlineData: { data: endFrame.split(',')[1], mimeType: "image/jpeg" } }
    ],
  });
  return response.text?.trim() || "A smooth cinematic transition between scenes.";
}

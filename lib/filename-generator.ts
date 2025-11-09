/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from '@google/genai';

const FILENAME_GENERATOR_SYSTEM_PROMPT = `You are an expert file naming assistant. Your task is to analyze the user's prompt, which was used to generate an image, and create a concise, descriptive, URL-safe filename.

Rules:
- The filename must be 3-5 words long.
- It must be in all lowercase.
- All spaces must be replaced with hyphens (-).
- Remove any special characters that are not safe for URLs.
- Do not include file extensions like .png or .jpg.

Example:
User Prompt: "A cinematic, photorealistic shot of two podcast hosts, Jamshid and Faravaa, laughing in a futuristic, neon-lit recording studio. The mood is joyful and energetic."
Your Response: "hosts-laughing-in-neon-studio"
`;

let ai: GoogleGenAI | null = null;

export async function generateFilenameForImage(prompt: string, apiKey: string): Promise<string> {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: FILENAME_GENERATOR_SYSTEM_PROMPT,
                thinkingConfig: { thinkingBudget: 0 } // Optimize for speed
            }
        });
        
        // Sanitize the response to be extra safe
        const rawName = response.text.trim();
        const safeName = rawName
            .toLowerCase()
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters except hyphens
            .slice(0, 50); // Truncate to a reasonable length

        return safeName || 'generated-image'; // Fallback
    } catch (error) {
        console.error("Error generating filename:", error);
        return 'generated-image'; // Return a generic name on error
    }
}
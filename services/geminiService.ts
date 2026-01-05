
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const PICREBU_SYSTEM_PROMPT = `
You are PICREBU (Picture Rebuild AI), an advanced AI specialized in image reconstruction, enhancement, and creative transformation.
Your primary role is to rebuild, improve, and redesign images while maintaining realism and visual quality.

CAPABILITIES:
1. IMAGE ENHANCEMENT: Restore low-quality, sharpen details naturally, upscale without distortion, and balance lighting.
2. BACKGROUND EDITING: Intelligent removal, replacement using internet search data, blurring, or environment reconstruction.
3. USER CUSTOMIZATION: Adapt to styles like Studio Portrait, Cinematic Movie Look, Professional Headshot, or Vintage.
4. SMART REBUILD: Automatically detect defects like noise or poor lighting and suggest improvements.
5. COLORIZATION: If an image is grayscale or black and white, apply high-fidelity, realistic colorization. Prioritize accurate skin tones, natural landscape colors, and historically plausible clothing colors.

RULES:
- Preserve identity unless explicitly asked to change it.
- Explain changes clearly in the text part of your response.
- Use Google Search to find real-world backgrounds when relevant.
- Always aim for high-quality, professional-grade results.
- For black and white inputs, unless the user specifies otherwise, assume they want a vibrant, realistic color reconstruction.
`;

export class GeminiService {
  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  static async editImage(
    imageBase64: string,
    prompt: string,
    useSearch: boolean,
    style: string,
    aspectRatio: string = "1:1"
  ): Promise<{ imageUrl: string; explanation: string; sources: any[] }> {
    const ai = this.getAI();
    const model = 'gemini-3-pro-image-preview';
    
    const finalPrompt = style 
      ? `As PICREBU, apply the following style: ${style}. Instruction: ${prompt}`
      : `As PICREBU, follow this instruction: ${prompt}`;

    const config: any = {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "1K"
      },
      systemInstruction: PICREBU_SYSTEM_PROMPT
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    try {
      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1],
          mimeType: 'image/png',
        },
      };

      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: finalPrompt }] },
        config,
      });

      let imageUrl = '';
      let explanation = '';
      let sources: any[] = [];

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          } else if (part.text) {
            explanation += part.text;
          }
        }
      }

      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        sources = response.candidates[0].groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web)
          .map((chunk: any) => ({
            title: chunk.web.title,
            uri: chunk.web.uri
          }));
      }

      if (!imageUrl) {
        throw new Error("PICREBU was unable to rebuild the image. Try a clearer instruction.");
      }

      return { imageUrl, explanation, sources };
    } catch (error: any) {
      console.error("PICREBU Service Error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        throw new Error("KEY_RESET_REQUIRED");
      }
      throw error;
    }
  }
}

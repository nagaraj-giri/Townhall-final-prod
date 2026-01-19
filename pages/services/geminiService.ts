
import { GoogleGenAI, Type } from "@google/genai";

export const getAIConciergeSuggestions = async (query: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User is looking for a service in Dubai/UAE. Query: "${query}". 
      Available Categories: PRO Services, Travel Agencies, Logistics, Company Setup, Legal, Home Maintenance.
      Task:
      1. Categorize the request.
      2. Provide a professional title.
      3. Rewrite the description to be clear for providers.
      4. List 2-3 required documents typical for this UAE service.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            suggestedDescription: { type: Type.STRING },
            requiredDocs: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["suggestedTitle", "suggestedCategory", "suggestedDescription"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Concierge Error:", error);
    return null;
  }
};

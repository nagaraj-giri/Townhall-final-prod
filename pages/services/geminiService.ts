import { GoogleGenAI } from "@google/genai";

/**
 * AI Concierge service for Town Hall UAE.
 * Uses Gemini to structure user requests and validate Dubai locations via Google Maps grounding.
 */
export const getAIConciergeSuggestions = async (query: string, locationHint?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Context: A service marketplace in Dubai, UAE. 
      Input: "${query}"
      Location: "${locationHint || 'Dubai'}"
      
      Task:
      1. Choose the most relevant category from: PRO Services, Travel Agencies, Logistics, Company Setup, Legal, Home Maintenance.
      2. Rewrite the title to be professional and standard for UAE government/business entities.
      3. Rewrite the description to include professional terminology used in Dubai (e.g., 'Trakhees', 'DED', 'Ejari' if relevant).
      4. List 2-3 required documents standard for this request in the UAE.
      
      Output exactly in this format:
      TITLE: [Rewritten Title]
      CATEGORY: [Selected Category]
      DESCRIPTION: [Detailed Professional Description]
      DOCS: [Doc 1, Doc 2]`,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    const text = response.text || "";
    
    const titleMatch = text.match(/TITLE:\s*(.*)/i);
    const catMatch = text.match(/CATEGORY:\s*(.*)/i);
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]*?)(?=DOCS:|$)/i);
    const docsMatch = text.match(/DOCS:\s*(.*)/i);

    return {
      suggestedTitle: titleMatch ? titleMatch[1].trim() : query,
      suggestedCategory: catMatch ? catMatch[1].trim() : "PRO Services",
      suggestedDescription: descMatch ? descMatch[1].trim() : query,
      requiredDocs: docsMatch ? docsMatch[1].split(',').map(s => s.trim()) : []
    };
  } catch (error) {
    console.error("AI Concierge Error:", error);
    return null;
  }
};
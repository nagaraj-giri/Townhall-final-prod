
import { GoogleGenAI } from "@google/genai";

/**
 * AI Concierge service for Town Hall UAE.
 * Uses Gemini to structure user requests and validate Dubai locations via Google Maps grounding.
 */
export const getAIConciergeSuggestions = async (query: string, locationHint?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // We use gemini-2.5-flash because the PRD requires Maps Grounding for location context.
    // Note: responseMimeType is not allowed when using googleMaps tool.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User is looking for a service in Dubai, UAE. 
      Input: "${query}"
      Location provided: "${locationHint || 'Not specified'}"
      
      Available categories: PRO Services, Travel Agencies, Logistics, Company Setup, Legal, Home Maintenance.
      
      Task:
      1. Identify the best category.
      2. Generate a professional request title.
      3. Rewrite the description to be detailed for service providers.
      4. List 2-3 required documents typical for this service in UAE.
      5. Check if the location "${locationHint}" is a well-known Dubai district or landmark.
      
      Output format (strictly use this structure):
      TITLE: [Professional Title]
      CATEGORY: [Category Name]
      DESCRIPTION: [Clear detailed description]
      DOCS: [Doc 1, Doc 2]
      LOCATION_CHECK: [Confidence message about the Dubai location]`,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    const text = response.text || "";
    
    // Parse the response manually since JSON mode isn't supported with grounding tools
    const titleMatch = text.match(/TITLE:\s*(.*)/i);
    const catMatch = text.match(/CATEGORY:\s*(.*)/i);
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]*?)(?=DOCS:|$)/i);
    const docsMatch = text.match(/DOCS:\s*(.*)/i);
    const locMatch = text.match(/LOCATION_CHECK:\s*(.*)/i);

    // Extract grounding URLs if available (required by system instructions)
    const groundingLinks = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.maps?.title,
      uri: chunk.maps?.uri
    })).filter((l: any) => l.uri) || [];

    return {
      suggestedTitle: titleMatch ? titleMatch[1].trim() : "",
      suggestedCategory: catMatch ? catMatch[1].trim() : "",
      suggestedDescription: descMatch ? descMatch[1].trim() : "",
      requiredDocs: docsMatch ? docsMatch[1].split(',').map(s => s.trim()) : [],
      locationConfidence: locMatch ? locMatch[1].trim() : "",
      groundingLinks
    };
  } catch (error) {
    console.error("AI Concierge Error:", error);
    return null;
  }
};

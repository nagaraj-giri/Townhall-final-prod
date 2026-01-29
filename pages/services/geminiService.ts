
import { GoogleGenAI } from "@google/genai";
import { RFQ, User, UserRole } from "../../types";

/**
 * AIRRA (Advanced Intelligent Real-time Response Architecture)
 * ROLE: Silent Operational Engine / Background Logic Controller.
 * CONSTRAINT: Strictly no direct interaction with users.
 * OUTPUTS: Data standardization, algorithmic matching, and strategic annotations only.
 */

const getAIRRAInstance = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Official UAE Service Streams - AIRRA Regulated
export const UAE_SERVICE_STREAMS = [
  "Visa Services / Business Setup",
  "Tours & Travels",
  "Packers and Movers",
  "Marketing / Payroll Service",
  "Home Service"
];

/**
 * FUNCTION: AIRRA Standardization Logic
 * TASK: Non-conversational mapping of raw input to system keys.
 */
export const getAIConciergeSuggestions = async (query: string, locationHint?: string) => {
  const ai = getAIRRAInstance();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: `IDENTITY: Background Standardization Engine.
      TASK: Extract system keys from query.
      
      INPUT: "${query}"
      LOCATION: "${locationHint || 'Dubai'}"
      
      CONSTRAINTS:
      1. Map to: ${UAE_SERVICE_STREAMS.join(", ")}.
      2. No conversational filler. No "Here is your...".
      
      OUTPUT FORMAT (JSON):
      {
        "suggestedTitle": "Professional Title",
        "suggestedCategory": "Exact Key",
        "suggestedDescription": "Standardized context"
      }`,
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || 'null');
  } catch (error) {
    return null;
  }
};

/**
 * FUNCTION: AIRRA Strategic Fit Annotation
 * TASK: Purely analytical explanation of why a bid is statistically relevant.
 */
export const performStrategicMatchAnalysis = async (rfq: RFQ, providers: User[]) => {
  const ai = getAIRRAInstance();
  
  const providerPool = providers.map(p => ({
    id: p.id,
    name: p.name,
    expertise_tags: p.categories || [],
    rating: p.rating || 0
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `IDENTITY: Silent Logic Engine.
      TASK: Annotate specific bidder relevance based on service keys and expertise tags.
      
      MARKETPLACE DATA:
      - SERVICE: ${rfq.service}
      - TITLE: ${rfq.title}
      
      PROVIDER DATA:
      ${JSON.stringify(providerPool)}
      
      CONSTRAINTS:
      1. No direct address to the user.
      2. Output must be purely descriptive data.
      
      RETURN JSON FORMAT:
      {
        "matches": [
          { 
            "providerId": "string", 
            "relevancyScore": 0.0-1.0, 
            "reasoning": "Data-driven fit analysis based on specific niche alignment." 
          }
        ]
      }`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || '{"matches": []}');
    return result.matches;
  } catch (error) {
    console.error("AIRRA Logic Error:", error);
    return [];
  }
};

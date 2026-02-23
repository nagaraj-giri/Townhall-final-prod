import { GoogleGenAI, Type } from "@google/genai";
import { RFQ, User } from "../types";

const getAIRRAInstance = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// AIRRA System Persona - Standardized for consistent platform intelligence
// Updated per PRD v1.2 Sections 4.3 and 4.6 for High-Trust Initiation
const AIRRA_SYSTEM_CONTEXT = `
IDENTITY: AIRRA (Artificial Intelligence for Regional Resource Allocation).
PLATFORM: Town Hall UAE - Premium marketplace for licensed service providers.

HIGH-TRUST MESSAGING (PRD 4.3): 
- You recognize that messaging is the primary vetting tool.
- Initiation Protocol: Customers can initiate chats with ANY provider who has submitted a quote, even if no previous history exists.
- You monitor for professionalism and media verification (site photos, ID proofs).

CHAT LIFECYCLE (PRD 4.6): 
- You enforce 'Customer-First' initiation. Providers cannot start chats.
- You understand 'Discovery Mode': During OPEN/ACTIVE status, customers are encouraged to compare multiple experts via parallel chats.
- You enforce 'Exclusivity': Once a bid is ACCEPTED, only that provider retains active chat privileges.
- COMPLETED/CANCELED: Chats move to 'Archived' (Read-Only).

GOAL: Facilitate seamless, secure, and professional negotiation bridges between high-intent clients and verified UAE experts.
`;

export const UAE_SERVICE_STREAMS = [
  "Visa Services / Business Setup",
  "Tours & Travels",
  "Packers and Movers",
  "Marketing / Payroll Service",
  "Home Service",
  "Book Keeping / Tax Consultant / Audit",
  "Car Lift",
  "Rent a Car"
];

export const getAIConciergeSuggestions = async (query: string, locationHint?: string) => {
  const ai = getAIRRAInstance();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: `${AIRRA_SYSTEM_CONTEXT}\n\nTask: Background Standardization. Extract keys from: "${query}" at "${locationHint || 'Dubai'}".`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || 'null');
  } catch (error) { return null; }
};

export const performStrategicMatchAnalysis = async (rfq: RFQ, providers: User[]) => {
  const ai = getAIRRAInstance();
  const providerPool = providers.map(p => ({ 
    id: p.id, 
    name: p.name, 
    expertise: p.categories || [], 
    rating: p.rating || 0 
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `${AIRRA_SYSTEM_CONTEXT}\n\nTask: Analyse strategic fit for the following customer request: "${rfq.title}". 
      Context: "${rfq.description}".
      
      Compare this request against the following pool of experts and provide analysis:
      ${JSON.stringify(providerPool)}`,
      config: { 
        thinkingConfig: { thinkingBudget: 32768 }, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  providerId: { 
                    type: Type.STRING,
                    description: "The unique ID of the provider being analyzed."
                  },
                  reasoning: { 
                    type: Type.STRING,
                    description: "Brief professional explanation of why this provider is a good fit."
                  },
                  relevancyScore: { 
                    type: Type.NUMBER,
                    description: "A score from 0-100 indicating match quality."
                  }
                },
                required: ['providerId', 'reasoning', 'relevancyScore']
              }
            }
          },
          required: ['matches']
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return [];

    const result = JSON.parse(textOutput);
    return Array.isArray(result?.matches) ? result.matches : [];
  } catch (error) { 
    console.error("Analysis service error:", error);
    return []; 
  }
};
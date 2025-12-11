
import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { GEMINI_MODEL_TEXT } from '../constants';
import { Coordinates, GroundingChunk, ChatMessage } from "../types";

// Per guidelines, initialize client directly. The execution environment is expected
// to provide a valid API_KEY. This will fail early if the key is not configured.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
console.log('GeminiService: API key loaded:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No');

if (!apiKey) {
  console.error('GeminiService: No API key found! Please check your .env.local file.');
}

const ai = new GoogleGenAI({ apiKey });

export const generatePlaceInfo = async (
  placeName: string,
  placeCategory: string,
  coordinates: Coordinates,
  language: string
): Promise<{description: string, sources: GroundingChunk[]}> => {
  try {
    const prompt = `You are a friendly and informative travel buddy for Gozo. Your response must be in the language with the ISO 639-1 code: "${language}" and strictly under 900 characters. Provide a concise and engaging description (2-3 sentences) for a place called "${placeName}", which is a ${placeCategory}, located near latitude ${coordinates.lat} and longitude ${coordinates.lng}. Highlight what makes it special or interesting for a tourist. Also, provide one fun fact if possible. Then, search the web for more information.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
      },
    });
    
    // Using the .text property for direct string output is the recommended approach.
    const genText = response.text?.trim() || '';
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(
        (chunk): chunk is GroundingChunk => !!chunk.web
      ) || [];

    return { description: genText, sources };

  } catch (error) {
    console.error("Error generating place description from Gemini:", error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      if (error.message.includes('API key')) {
        throw new Error("AI service authentication failed. Please check your API key.");
      } else if (error.message.includes('quota')) {
        throw new Error("AI service quota exceeded. Please try again later.");
      } else if (error.message.includes('network')) {
        throw new Error("Network error. Please check your internet connection.");
      }
    }
    
    throw new Error("Could not generate AI description. Please try again.");
  }
};

export const getChatResponse = async (history: ChatMessage[], placeName: string, language: string): Promise<string> => {
  try {
    // Format the history for the API
    const contents: Content[] = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const response = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: contents,
        config: {
            systemInstruction: `You are a helpful and friendly travel assistant for the island of Gozo. Your response must be in the language with the ISO 639-1 code: "${language}" and strictly under 900 characters. Your current conversation is about a place called "${placeName}". Keep your answers concise and relevant to a tourist visiting this location.`,
            temperature: 0.8,
            topP: 0.95,
            topK: 64,
        }
    });

    return response.text?.trim() || '';

  } catch (error) {
    console.error("Error getting chat response from Gemini:", error);
    
    if (error instanceof Error) {
        throw new Error('The AI assistant could not respond. Please try again in a moment.');
    }
    
    throw new Error('An unknown error occurred while contacting the AI assistant.');
  }
}
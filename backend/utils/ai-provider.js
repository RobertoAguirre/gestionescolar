// Configuración para múltiples proveedores de IA
// Soporta Claude (Anthropic) y Gemini (Google)

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const AI_PROVIDER = process.env.AI_PROVIDER || 'claude'; // 'claude' o 'gemini'

// Configuración de Claude
let anthropicClient = null;
if (AI_PROVIDER === 'claude' && process.env.ANTHROPIC_API_KEY) {
  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// Configuración de Gemini (se inicializará cuando se agregue la API key)
let geminiClient = null;
if (AI_PROVIDER === 'gemini' && process.env.GEMINI_API_KEY) {
  // Se implementará cuando se agregue la API key
  // const { GoogleGenerativeAI } = await import('@google/generative-ai');
  // geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

export async function generateResponse(messages, systemPrompt, options = {}) {
  const {
    maxTokens = 1024,
    temperature = 0.7,
    responseStyle = 'normal' // 'normal', 'simplified', 'short', 'accessible'
  } = options;

  // Adaptar system prompt según el estilo de respuesta
  let adaptedSystemPrompt = systemPrompt;
  if (responseStyle === 'simplified' || responseStyle === 'accessible') {
    adaptedSystemPrompt += '\n\nIMPORTANTE: Responde con lenguaje simple y claro. Usa frases cortas. Evita términos técnicos complejos.';
  }
  if (responseStyle === 'short') {
    adaptedSystemPrompt += '\n\nIMPORTANTE: Responde de forma muy breve y concisa. Máximo 2-3 oraciones.';
  }
  if (responseStyle === 'accessible') {
    adaptedSystemPrompt += '\n\nIMPORTANTE: Responde de forma accesible. Usa lenguaje claro, frases cortas, y estructura simple. Evita jerga técnica.';
  }

  try {
    if (AI_PROVIDER === 'claude' && anthropicClient) {
      const response = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        temperature: temperature,
        system: adaptedSystemPrompt,
        messages: messages
      });
      return response.content[0].text;
    } else if (AI_PROVIDER === 'gemini' && geminiClient) {
      // Implementación para Gemini cuando esté disponible
      // const model = geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      // const result = await model.generateContent({
      //   contents: messages,
      //   systemInstruction: adaptedSystemPrompt
      // });
      // return result.response.text();
      throw new Error('Gemini no está configurado aún. Agrega GEMINI_API_KEY en .env');
    } else {
      throw new Error(`Proveedor de IA no configurado: ${AI_PROVIDER}`);
    }
  } catch (error) {
    console.error('Error generando respuesta:', error);
    throw error;
  }
}

export function getAIProvider() {
  return AI_PROVIDER;
}

export function isProviderConfigured() {
  if (AI_PROVIDER === 'claude') {
    return !!anthropicClient;
  } else if (AI_PROVIDER === 'gemini') {
    return !!geminiClient;
  }
  return false;
}

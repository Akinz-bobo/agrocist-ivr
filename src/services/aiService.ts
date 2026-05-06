import OpenAI from "openai";
import config from "../config";
import logger from "../utils/logger";
import { IVRResponse } from "../types";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import https from "https";

// Africa's Talking internal recording URLs use a self-signed cert
const atInsecureAgent = new https.Agent({ rejectUnauthorized: false });

export enum SupportedLanguage {
  ENGLISH = "en",
  HAUSA = "ha",
  IGBO = "ig",
  YORUBA = "yo",
}

/**
 * Handles AI-related operations:
 *   - Speech-to-text transcription (OpenAI Whisper / ElevenLabs Scribe)
 *   - Veterinary query processing (OpenAI GPT-4o-mini)
 *
 * STT provider selection:
 *   - Hausa and Igbo → ElevenLabs Scribe (better accuracy for these languages)
 *   - English and Yoruba → OpenAI Whisper
 */
class AIService {
  private openai: OpenAI;
  private elevenLabs: ElevenLabsClient;

  constructor() {
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    this.elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }

  // ─── Veterinary query ──────────────────────────────────────────────────────

  /**
   * Process a farmer's veterinary question and return an AI-generated response.
   * Includes conversation history from the current call for context continuity.
   */
  async processVeterinaryQuery(query: string, context?: any): Promise<IVRResponse> {
    const startTime = Date.now();
    try {
      if (!this.hasValidApiKey()) {
        logger.info("No valid OpenAI key — returning fallback response");
        return {
          response: "I'm sorry, I'm unable to process your request at the moment. Please try again later or press 4 to speak with one of our veterinary experts.",
          nextAction: "end",
        };
      }

      const language = context?.language ?? "en";
      const sessionId = context?.sessionId;

      // Prepend conversation history so the AI has memory within the call
      let prompt = query;
      if (sessionId) {
        const sessionManager = (await import("../utils/sessionManager")).default;
        const history = sessionManager.formatConversationContext(sessionId);
        if (history) {
          prompt = history + "\nCurrent question: " + query;
          logger.info(`Including conversation context for ${sessionId}`);
        }
      }

      const response = await this.queryOpenAI(prompt, language);
      if (!response) throw new Error("Empty response from OpenAI");

      const confidence = this.calculateConfidence(response, query);
      logger.info(`AI response in ${Date.now() - startTime}ms (confidence: ${confidence})`);

      return {
        response,
        nextAction: confidence < config.ai.confidenceThreshold ? "transfer" : "menu",
      };
    } catch (error) {
      logger.error(`AI query failed after ${Date.now() - startTime}ms:`, error);
      return {
        response: "I'm having trouble processing your request right now. Let me connect you with one of our veterinary experts.",
        nextAction: "transfer",
      };
    }
  }

  // ─── Speech-to-text ────────────────────────────────────────────────────────

  /**
   * Transcribe a voice recording URL to text.
   * Routes to ElevenLabs for Hausa/Igbo, OpenAI for English/Yoruba.
   */
  async transcribeAudio(audioUrl: string, language: string = "en"): Promise<string> {
    const startTime = Date.now();
    try {
      const result = (language === "ha" || language === "ig")
        ? await this.transcribeWithElevenLabs(audioUrl, language as SupportedLanguage)
        : await this.transcribeWithOpenAI(audioUrl, language as SupportedLanguage);

      logger.info(`Transcribed in ${Date.now() - startTime}ms: "${result}"`);
      return result;
    } catch (error: any) {
      logger.error(`Transcription failed for ${language}:`, error);
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private hasValidApiKey(): boolean {
    return !!(config.openai.apiKey && config.openai.apiKey !== "test_openai_key");
  }

  /** Send a prompt to GPT-4o-mini with the veterinary system prompt. */
  private async queryOpenAI(prompt: string, language: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: this.getSystemPrompt(language) },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,       // Conversational, not robotic
      max_tokens: 200,        // ~30-45 seconds of speech
      top_p: 0.95,
      frequency_penalty: 0.3, // Discourage repetitive phrases
      presence_penalty: 0.2,  // Encourage varied vocabulary
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  /**
   * System prompt for the veterinary AI assistant.
   * Instructs the model to respond like a friendly Nigerian farmer-expert,
   * keep responses short and actionable, and match the caller's language.
   */
  private getSystemPrompt(language: string = "en"): string {
    return "You're a professional veterinary expert who speaks like a friendly Nigerian farmer. Give accurate, reliable advice about animal health, farming, livestock, poultry, and fishery using simple English that farmers easily understand. Sound conversational with natural Nigerian filler words like 'you see', 'actually', 'ehen' 'aha' 'i see', 'oh' 'sorry to hear that', but maintain professional accuracy. KEEP RESPONSES SHORT - maximum 30-45 seconds when spoken (about 100-120 words). Focus on the most important 1-2 actionable steps the farmer can take immediately. When users speak in Yoruba, Hausa, or Igbo, respond naturally in their language. If their phrasing isn't perfect, understand their intended meaning and provide helpful, actionable solutions they can use immediately on their farm. Recommend specific treatment, and management the farmer can adopt or use pending the arrival of a veterinarian. IMPORTANT: Never use structured labels like 'Nutrition:', 'Water:', 'Vaccination:', 'Health Check:', etc. Instead, flow your advice naturally in conversation. Be direct, helpful, conversational and avoid any formal structure or bullet points. CRITICAL: If the user's question is in Yoruba, Hausa, or Igbo, you MUST respond COMPLETELY in that same language - do not mix with English or pidgin. Use pure Yoruba for Yoruba questions, pure Hausa for Hausa questions, pure Igbo for Igbo questions. CONVERSATION MEMORY: When previous conversation context is provided, acknowledge the farmer's diverse farming activities briefly, then focus on answering their current question concisely.";
  }

  /**
   * Simple confidence score based on response characteristics.
   * Lower confidence triggers an agent transfer recommendation.
   */
  private calculateConfidence(response: string, query: string): number {
    let confidence = 0.8;

    const uncertainWords = ["might", "could", "possibly", "perhaps", "not sure", "unclear"];
    confidence -= uncertainWords.filter((w) => response.toLowerCase().includes(w)).length * 0.15;

    if (response.length < 50) confidence -= 0.2;
    if (response.toLowerCase().includes("consult") || response.toLowerCase().includes("veterinarian")) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /** Transcribe audio using ElevenLabs Scribe (better for Hausa and Igbo). */
  private async transcribeWithElevenLabs(audioUrl: string, language: SupportedLanguage): Promise<string> {
    const axios = (await import("axios")).default;
    const isATInternal = audioUrl.includes(".at-internal.com");

    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      ...(isATInternal && { httpsAgent: atInsecureAgent }),
    });

    const audioBlob = new Blob([audioResponse.data], { type: "audio/mp3" });

    // ElevenLabs uses ISO 639-3 language codes
    const languageCodeMap: Record<SupportedLanguage, string> = {
      [SupportedLanguage.ENGLISH]: "eng",
      [SupportedLanguage.HAUSA]: "hau",
      [SupportedLanguage.IGBO]: "ibo",
      [SupportedLanguage.YORUBA]: "yor",
    };

    const transcription: any = await this.elevenLabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v1",
      languageCode: languageCodeMap[language],
    });

    return transcription.text ?? transcription.words?.text ?? "";
  }

  /** Transcribe audio using OpenAI Whisper (used for English and Yoruba). */
  private async transcribeWithOpenAI(audioUrl: string, language: SupportedLanguage): Promise<string> {
    const axios = (await import("axios")).default;
    const isATInternal = audioUrl.includes(".at-internal.com");

    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      ...(isATInternal && { httpsAgent: atInsecureAgent }),
    });

    const audioFile = new File([Buffer.from(audioResponse.data)], "recording.mp3", { type: "audio/mp3" });

    const transcription: any = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-transcribe",
      prompt: "The speaker is a Nigerian farmer speaking Yoruba, Igbo or Hausa. Transcribe clearly with correct tones.",
      response_format: "json",
      temperature: 0.0,
    });

    return transcription.text ?? transcription.words?.text ?? "";
  }
}

export default new AIService();

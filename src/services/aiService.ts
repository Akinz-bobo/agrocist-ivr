import OpenAI from "openai";
import config from "../config";
import logger from "../utils/logger";
import { IVRResponse } from "../types";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { removeTextFormatting } from "../utils/textFormater";

export enum SupportedLanguage {
  ENGLISH = "en",
  HAUSA = "ha",
  IGBO = "ig",
  YORUBA = "yo",
}

interface STTResponse {
  text: string;
  confidence: number;
  language: SupportedLanguage;
  processingTime: number;
  provider: string;
}

class AIService {
  private openai: OpenAI;

  private client: ElevenLabsClient;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  async processVeterinaryQuery(
    query: string,
    context?: any
  ): Promise<IVRResponse> {
    const startTime = Date.now();
    try {
      const aiProvider = config.ai.provider;

      // Check if we have a valid API key for the selected provider
      const hasValidKey = this.hasValidApiKey(aiProvider);
      if (!hasValidKey) {
        logger.info(`Using mock AI response (no valid ${aiProvider} key)`);
        return {
          response:
            "I'm sorry, I'm unable to process your request at the moment. Please try again later or press 4 to speak with one of our veterinary experts.",
          nextAction: "end",
        };
      }

      const language = context?.language || "en";
      const sessionId = context?.sessionId;

      // Always provide conversation context if available - let AI decide when to use it
      let prompt = query;
      if (sessionId) {
        const sessionManager = (await import("../utils/sessionManager"))
          .default;
        const conversationContext =
          sessionManager.formatConversationContext(sessionId);

        if (conversationContext) {
          prompt = conversationContext + "\nCurrent question: " + query;
          logger.info(
            `🔗 Providing conversation context to AI for session: ${sessionId}`
          );
        }
      }

      logger.info(`⚡ Starting AI query with provider: ${aiProvider}`);

      let response: string;
      let aiTime: number;

      response = await this.processWithOpenAI(prompt, language, startTime);
      aiTime = Date.now() - startTime;

      if (!response) {
        throw new Error("Empty response from AI service");
      }

      const confidence = this.calculateConfidence(response, query);

      logger.info(
        `⚡ AI processed veterinary query in ${aiTime}ms with confidence: ${confidence}`
      );

      return {
        response: response, // Don't format here - let voiceController handle all text processing
        nextAction:
          confidence < config.ai.confidenceThreshold ? "transfer" : "menu",
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(
        `Error processing veterinary query after ${totalTime}ms:`,
        error
      );
      return {
        response:
          "I'm having trouble processing your request right now. Let me connect you with one of our veterinary experts.",
        nextAction: "transfer",
      };
    }
  }

  private hasValidApiKey(provider: string): boolean {
    return !!(
      config.openai.apiKey && config.openai.apiKey !== "test_openai_key"
    );
  }

  private async processWithOpenAI(
    prompt: string,
    language: string,
    startTime: number
  ): Promise<string> {
    // Use faster model for quicker responses (gpt-4o-mini is much faster than gpt-4o)

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: this.getVeterinarySystemPrompt(language),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7, // Higher for more creative, varied responses (was 0.2 - too robotic)
      max_tokens: 200, // ~30-45 seconds of speech to prevent Spitch truncation
      top_p: 0.95, // Allow more token variety for natural conversation
      frequency_penalty: 0.3, // Discourage repetitive phrases like "I understand..."
      presence_penalty: 0.2, // Encourage introducing new topics/ideas
    });

    return completion.choices[0]?.message?.content || "";
  }

  private getVeterinarySystemPrompt(language: string = "en"): string {
    return "You're a professional veterinary expert who speaks like a friendly Nigerian farmer. Give accurate, reliable advice about animal health, farming, livestock, poultry, and fishery using simple English that farmers easily understand. Sound conversational with natural Nigerian filler words like 'you see', 'actually', 'ehen' 'aha' 'i see', 'oh' 'sorry to hear that', but maintain professional accuracy. KEEP RESPONSES SHORT - maximum 30-45 seconds when spoken (about 100-120 words). Focus on the most important 1-2 actionable steps the farmer can take immediately. When users speak in Yoruba, Hausa, or Igbo, respond naturally in their language. If their phrasing isn't perfect, understand their intended meaning and provide helpful, actionable solutions they can use immediately on their farm. Recommend specific treatment, and management the farmer can adopt or use pending the arrival of a veterinarian. IMPORTANT: Never use structured labels like 'Nutrition:', 'Water:', 'Vaccination:', 'Health Check:', etc. Instead, flow your advice naturally in conversation. Be direct, helpful, conversational and avoid any formal structure or bullet points. CRITICAL: If the user's question is in Yoruba, Hausa, or Igbo, you MUST respond COMPLETELY in that same language - do not mix with English or pidgin. Use pure Yoruba for Yoruba questions, pure Hausa for Hausa questions, pure Igbo for Igbo questions. CONVERSATION MEMORY: When previous conversation context is provided, acknowledge the farmer's diverse farming activities briefly, then focus on answering their current question concisely.";
  }

  private calculateConfidence(response: string, query: string): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.8;

    // Lower confidence for uncertain language
    const uncertainWords = [
      "might",
      "could",
      "possibly",
      "perhaps",
      "not sure",
      "unclear",
    ];
    const uncertainCount = uncertainWords.filter((word) =>
      response.toLowerCase().includes(word)
    ).length;

    confidence -= uncertainCount * 0.15;

    // Lower confidence for very short responses
    if (response.length < 50) {
      confidence -= 0.2;
    }

    // Lower confidence if recommending veterinary consultation
    if (
      response.toLowerCase().includes("consult") ||
      response.toLowerCase().includes("veterinarian")
    ) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  async transcribeAudio(
    audioUrl: string,
    language: string = "en"
  ): Promise<string> {
    const startTime = Date.now();

    try {
      let result: string;

      // Use ElevenLabs for Hausa and Igbo, OpenAI for English and Yoruba
      if (language === "ha" || language === "ig") {
        result = await this.transcribeWithElevenLabs(
          audioUrl,
          language as SupportedLanguage
        );
      } else {
        result = await this.transcribeWithOpenAI(
          audioUrl,
          language as SupportedLanguage
        );
      }

      const processingTime = Date.now() - startTime;
      logger.info(
        `⚡ Audio transcribed in ${processingTime}ms (total: ${processingTime}ms): "${result}"`
      );

      return result;
    } catch (error: any) {
      logger.error(`Transcription failed for ${language}:`, error);
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }

  private async transcribeWithElevenLabs(
    audioUrl: string,
    language: SupportedLanguage
  ): Promise<string> {
    try {
      const axios = (await import("axios")).default;

      // Download audio file as buffer
      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
      });
      const audioBlob = new Blob([audioResponse.data], {
        type: "audio/mp3",
      });

      // Language mapping for ElevenLabs (3-letter codes)
      const languageMap = {
        [SupportedLanguage.ENGLISH]: "eng",
        [SupportedLanguage.HAUSA]: "hau",
        [SupportedLanguage.IGBO]: "ibo",
        [SupportedLanguage.YORUBA]: "yor",
      };

      const transcription: any = await this.client.speechToText.convert({
        file: audioBlob,
        modelId: "scribe_v1",
        languageCode: languageMap[language],
      });

      return transcription.text || transcription.words.text || "";
    } catch (error: any) {
      logger.error("ElevenLabs STT error", { error: error.message });
      throw new Error(`ElevenLabs STT failed: ${error.message}`);
    }
  }

  private async transcribeWithOpenAI(
    audioUrl: string,
    language: SupportedLanguage
  ): Promise<string> {
    try {
      const axios = (await import("axios")).default;

      // Download audio file as buffer first
      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
      });
      const audioBuffer = Buffer.from(audioResponse.data);
      const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });
      const audioFile = new File([audioBlob], "recording.mp3", {
        type: "audio/mp3",
      });

      const transcription: any = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-transcribe",
        prompt:
          "The speaker is a Nigerian farmer speaking Yoruba,Igbo or Hausa. Transcribe clearly with correct tones ensure you correctly get what they say if possible.",
        response_format: "json",
        temperature: 0.0,
      });

      return transcription.text || transcription.words.text || "";
    } catch (error: any) {
      logger.error("OpenAI STT error", {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        audioUrl,
      });
      throw new Error(`OpenAI STT failed: ${error.message}`);
    }
  }
}

export default new AIService();

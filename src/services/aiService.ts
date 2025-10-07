import OpenAI from 'openai';
import config from '../config';
import logger from '../utils/logger';
import { LivestockQuery, IVRResponse } from '../types';

class AIService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  
  async processVeterinaryQuery(query: string, context?: any): Promise<IVRResponse> {
    const startTime = Date.now();
    try {
      // Check if we have a valid API key
      if (!config.openai.apiKey || config.openai.apiKey === 'test_openai_key') {
        logger.info('Using mock AI response (no valid OpenAI key)');
        return this.getMockVeterinaryResponse(query, context?.language);
      }

      const prompt = this.buildVeterinaryPrompt(query, context);
      const language = context?.language || 'en';

      // Use faster model for quicker responses (gpt-4o-mini is much faster than gpt-4o)
      const model = config.openai.model.includes('mini') ? config.openai.model : 'gpt-4o-mini';

      logger.info(`⚡ Starting AI query with model: ${model}`);

      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: this.getVeterinarySystemPrompt(language)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2, // Lower for faster, more deterministic responses
        max_tokens: 200, // Reduced for faster responses (we want SHORT answers anyway)
        top_p: 0.9, // Slightly reduce token sampling for speed
        frequency_penalty: 0.0,
        presence_penalty: 0.0
      });

      const aiTime = Date.now() - startTime;

      const response = completion.choices[0]?.message?.content || '';
      if (!response) {
        throw new Error('Empty response from AI service');
      }
      const confidence = this.calculateConfidence(response, query);

      logger.info(`⚡ AI processed veterinary query in ${aiTime}ms with confidence: ${confidence}`);

      return {
        response: this.formatForAudio(response),
        nextAction: confidence < config.ai.confidenceThreshold ? 'transfer' : 'menu'
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`Error processing veterinary query after ${totalTime}ms:`, error);
      return {
        response: "I'm having trouble processing your request right now. Let me connect you with one of our veterinary experts.",
        nextAction: 'transfer'
      };
    }
  }
  
  async processGeneralQuery(query: string, context?: any): Promise<IVRResponse> {
    try {
      const prompt = this.buildGeneralPrompt(query, context);
      
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: "system",
            content: this.getGeneralSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 200
      });
      
      const response = completion.choices[0]?.message?.content || '';
      if (!response) {
        throw new Error('Empty response from AI service');
      }
      
      return {
        response: this.formatForAudio(response),
        nextAction: 'menu'
      };
      
    } catch (error) {
      logger.error('Error processing general query:', error);
      return {
        response: "I apologize, but I'm having difficulty understanding your request. Please try again or press 4 to speak with one of our experts.",
        nextAction: 'menu'
      };
    }
  }
  
  async classifyQuery(query: string): Promise<{ category: 'veterinary' | 'farm_records' | 'products' | 'general', confidence: number }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: "system",
            content: `You are a query classifier for a livestock farming IVR system. Classify the following query into one of these categories:
            - veterinary: Animal health, diseases, symptoms, treatments, medical advice
            - farm_records: Farm information, livestock counts, records, data
            - products: Medications, feed, treatments, purchasing, orders
            - general: Greetings, general questions, unclear requests
            
            Respond with only the category name and confidence score (0-1) in this format: "category:confidence"`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 20
      });
      
      const response = completion.choices[0]?.message?.content || 'general:0.5';
      const [category, confidenceStr] = response.split(':');
      const confidence = parseFloat(confidenceStr || '0.5') || 0.5;
      
      return {
        category: category as 'veterinary' | 'farm_records' | 'products' | 'general',
        confidence
      };
      
    } catch (error) {
      logger.error('Error classifying query:', error);
      return { category: 'general', confidence: 0.5 };
    }
  }
  
  private getVeterinarySystemPrompt(language: string = 'en'): string {
    const prompts = {
      'en': `You are Dr. AgriBot, an expert veterinary AI for Nigerian livestock farmers. Provide SHORT, actionable advice for cattle, poultry, goats, sheep, and pigs.

CRITICAL RULES:
1. Keep responses under 100 words (call costs money)
2. Give 2-3 specific actions only
3. Use simple language for phone delivery
4. For emergencies (dying, bleeding, convulsions), say "urgent veterinary care needed"
5. NO long explanations or lists
6. RESPOND IN ENGLISH ONLY

FORMAT: Problem identification + immediate action + when to call vet

EMERGENCY: dying, bleeding, convulsions = "urgent veterinary care needed immediately"

Respond as if speaking directly to farmer over phone. Be concise and actionable.`,

      'yo': `E ni Dr. AgriBot, omo-iwe veterinary fun awon agbe omo-oja ni Nigeria. Fun imoran to kukuru ati to dara fun eran-oja: malu, adie, ewure, agutan, ati elede.

OFIN PATAKI:
1. Jeki idahun yin wa ni kere ju ogo mewa (ipe na gbe owo)
2. Fun ise mejo si meta nikan
3. Lo ede ti o roju fun ipe
4. Fun awon ipele pataki (iku, eje, wariri), so pe "a nilo itoju veterinary kiakia"
5. KO SI alaye gigun tabi akojo
6. DAHUN NI EDE YORUBA NIKAN

ILANA: Idamo isoro + ise ti o yara + igba lati pe veterinary

IPELE PATAKI: iku, eje, wariri = "a nilo itoju veterinary kiakia"

Dahun gege bi pe o n ba agbe soro ni ipe. Jeki o kukuru ati ki o le se.`,

      'ha': `Kai ne Dr. AgriBot, ƙwararren likitan dabbobi na Najeriya. Ba da gajerun shawarwari masu amfani don shanu, kaji, awaki, tumaki, da aladu.

MUHIMMAN DOKOKI:
1. Ka sa amsakuwa su kasance ƙasa da kalmomi ɗari (kiran yana cin kuɗi)
2. Ka ba da ayyuka 2-3 kawai
3. Yi amfani da sauƙin harshe don kiran
4. Don gaggawa (mutuwa, zubar da jini, rawan), ka ce "ana buƙatar kulawar likita da sauri"
5. BABU dogon bayani ko jeri
6. AMSA DA HAUSA KAWAI

TSARI: Gano matsala + aikin gaggawa + lokacin da za a kira likita

GAGGAWA: mutuwa, zubar da jini, rawan = "ana buƙatar kulawar likitan dabbobi da gaggawa"

Ka amsa kamar kana magana da manomi kai tsaye ta wayar. Ka taƙaita kuma ka yi aiki.`
    };

    return prompts[language as keyof typeof prompts] || prompts['en'];
  }
  
  private getGeneralSystemPrompt(): string {
    return `You are AgriBot, a helpful assistant for Agrocist, a livestock farming support service in Nigeria.

You help farmers with:
- General farming questions
- Information about our services
- Navigation through our IVR system
- Basic agricultural guidance

Keep responses:
- Under 150 words
- Simple and clear for audio delivery
- Friendly and professional
- Include relevant menu options (press 1 for farm records, press 2 for veterinary help, press 3 for products, press 4 for vet consultation)

If the question is about animal health, redirect to veterinary services.
If it's about purchasing, redirect to product services.`;
  }
  
  private buildVeterinaryPrompt(query: string, context?: any): string {
    let prompt = `Farmer's question: "${query}"`;
    
    if (context?.farmerId) {
      prompt += `\nFarmer ID: ${context.farmerId}`;
    }
    
    if (context?.animalType) {
      prompt += `\nAnimal type: ${context.animalType}`;
    }
    
    if (context?.location) {
      prompt += `\nLocation: ${context.location}`;
    }
    
    return prompt;
  }
  
  private buildGeneralPrompt(query: string, context?: any): string {
    let prompt = `Farmer's question: "${query}"`;
    
    if (context?.previousMenu) {
      prompt += `\nPrevious menu: ${context.previousMenu}`;
    }
    
    return prompt;
  }
  
  private calculateConfidence(response: string, query: string): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.8;
    
    // Lower confidence for uncertain language
    const uncertainWords = ['might', 'could', 'possibly', 'perhaps', 'not sure', 'unclear'];
    const uncertainCount = uncertainWords.filter(word => 
      response.toLowerCase().includes(word)
    ).length;
    
    confidence -= (uncertainCount * 0.15);
    
    // Lower confidence for very short responses
    if (response.length < 50) {
      confidence -= 0.2;
    }
    
    // Lower confidence if recommending veterinary consultation
    if (response.toLowerCase().includes('consult') || response.toLowerCase().includes('veterinarian')) {
      confidence -= 0.1;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  private formatForAudio(text: string): string {
    // Format text for better audio delivery
    return text
      .replace(/Dr\./g, 'Doctor')
      .replace(/(\d+)mg/g, '$1 milligrams')
      .replace(/(\d+)ml/g, '$1 milliliters')
      .replace(/(\d+)kg/g, '$1 kilograms')
      .replace(/(\d+)°C/g, '$1 degrees Celsius')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  async transcribeAudio(audioUrl: string, language?: string): Promise<string> {
    const startTime = Date.now();
    try {
      // Check if we have a valid API key
      if (!config.openai.apiKey || config.openai.apiKey === 'test_openai_key') {
        logger.info('Using mock transcription (no valid OpenAI key)');
        return this.getMockTranscription();
      }

      // Download the audio file with timeout for speed
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(audioUrl, {
        signal: controller.signal,
        // Add headers to potentially speed up download
        headers: {
          'Accept': 'audio/*'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const downloadTime = Date.now() - startTime;
      logger.info(`⚡ Audio downloaded in ${downloadTime}ms`);

      const audioBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

      const transcribeStart = Date.now();

      // Transcribe using OpenAI Whisper with optimizations
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        ...(language && { language }), // Include language only if specified
        temperature: 0.0 // Lower temperature for faster, more deterministic results
      });

      const transcribeTime = Date.now() - transcribeStart;
      const totalTime = Date.now() - startTime;
      const transcribedText = transcription.text || '';
      logger.info(`⚡ Audio transcribed in ${transcribeTime}ms (total: ${totalTime}ms): "${transcribedText}"`);

      return transcribedText;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`Error transcribing audio after ${totalTime}ms:`, error);
      // Fallback to mock transcription
      return this.getMockTranscription();
    }
  }

  private getMockTranscription(): string {
    const mockTranscriptions = [
      "My cow has been coughing and has a runny nose for the past two days. What should I do?",
      "I have a sick goat that is not eating and seems very weak. Please help me.",
      "My chickens are laying fewer eggs and some look sick. What medicine should I give them?",
      "One of my pigs has diarrhea and is not drinking water. I need urgent help.",
      "My cattle are showing signs of fever and are not grazing properly."
    ];
    
    const randomIndex = Math.floor(Math.random() * mockTranscriptions.length);
    return mockTranscriptions[randomIndex] ?? "My livestock needs help with health issues.";
  }

  private getMockVeterinaryResponse(query: string, language: string = 'en'): IVRResponse {
    const mockResponses = {
      'en': [
        "This sounds like respiratory infection. Isolate the animal, provide clean water, and monitor temperature. If no improvement in 24 hours, consult a veterinarian",
        "Likely nutritional deficiency or parasites. Give balanced feed, clean water, and deworm if not done recently. Provide electrolyte solution",
        "Possible bacterial infection. Isolate in clean area, provide good nutrition and hydration. Consult veterinarian if symptoms persist",
        "Could be feed quality issue. Check feed for mold, provide probiotics and fresh water. Monitor for 24 hours"
      ],
      'yo': [
        "Eyi dabi aisan mi mi. Ya eranko naa si ibi to mo, fun ni omi mimọ, wo iwọn otutu rẹ. Ti ko ba dara ni wakati mejila, kan veterinary",
        "O le jẹ aipe ounjẹ tabi kokoro. Fun ni ounjẹ ti o peye, omi mimọ, ti ko ba ti gba egbogi laipe. Fun ni omi electrolyte",
        "O le jẹ aisan kokoro. Ya si ibi ti o mọ, fun ni ounjẹ to dara ati omi. Kan veterinary ti aisan ba tẹsiwaju",
        "O le jẹ isoro ounjẹ. Wo ounjẹ fun efun, fun ni probiotic ati omi tuntun. Wo fun wakati mejila"
      ],
      'ha': [
        "Wannan kamar cutar numfashi ne. Ka ware dabbar, ka ba da ruwa mai tsabta, ka lura da zafin jiki. In babu sauyi a sa'o'i 24, ka tuntuɓi likitan dabbobi",
        "Mai yiyuwa rashin abinci mai gina jiki ko tsutsotsi ne. Ka ba da abinci mai daidaito, ruwa mai tsabta, ka ba da maganin tsutsotsi in ba a yi ba kwanan nan. Ka ba da maganin electrolyte",
        "Mai yiwuwa cutar ƙwayoyin cuta ce. Ka ware a wuri mai tsabta, ka ba da abinci mai kyau da ruwa. Ka tuntuɓi likita in alamun suka ci gaba",
        "Zai iya zama matsalar ingancin abinci. Ka duba abinci don yin fumfuna, ka ba da probiotics da ruwa sabo. Ka sa ido har sa'o'i 24"
      ]
    };
    
    const responses = mockResponses[language as keyof typeof mockResponses] || mockResponses['en'];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      response: this.formatForAudio(randomResponse || 'Please consult with a veterinarian for proper diagnosis'),
      nextAction: 'menu'
    };
  }
}

export default new AIService();
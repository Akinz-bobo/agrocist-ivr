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
        response: response, // Don't format here - let voiceController handle all text processing
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
        response: response, // Don't format here - let voiceController handle all text processing
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
            - veterinary: Animal health, diseases, symptoms, treatments, medical advice for livestock and fish
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
      'en': `You are Dr. AgriBot, an expert veterinary AI for Nigerian livestock farmers. Provide helpful advice for cattle, poultry, goats, sheep, pigs, and fish farming.

RESPONSE GUIDELINES:
1. SIMPLE QUESTIONS = SHORT ANSWERS (30-50 words): Direct, immediate solutions
2. COMPLEX QUESTIONS = DETAILED ANSWERS (100-150 words): Step-by-step guidance, causes, prevention
3. ALWAYS PROVIDE HELPFUL ANSWERS: Give the best advice possible with available information
4. Use simple language suitable for phone delivery
5. For emergencies (dying, bleeding, convulsions), say "urgent veterinary care needed immediately"
6. RESPOND IN ENGLISH ONLY

FORMAT FOR DETAILED ANSWERS: Problem + Cause + Solution + Prevention + When to call vet
FORMAT FOR SIMPLE ANSWERS: Direct action + When to call vet if needed

Be conversational and helpful. Always provide actionable advice even with limited information.`,

      'yo': `E ni Dr. AgriBot, omo-iwe veterinary fun awon agbe omo-oja ni Nigeria. Fun imoran to dara fun eran-oja: malu, adie, ewure, agutan, elede, ati eja.

ILANA IDAHUN:
1. IBEERE TI O RORU = IDAHUN KUKURU (ogo 30-50): Ojutu taara
2. IBEERE TI O NIRA = IDAHUN GIGUN (ogo 100-150): Ilana step-by-step, idi, idena
3. NIGBAGBOGBO FUN IDAHUN TO WULO: Fun imoran to dara ju pelu alaye ti o wa
4. Lo ede ti o roju fun ipe
5. Fun awon ipele pataki (iku, eje, wariri), so pe "a nilo itoju veterinary kiakia"
6. DAHUN NI EDE YORUBA NIKAN

ILANA FUN IDAHUN GIGUN: Isoro + Idi + Ojutu + Idena + Igba lati pe veterinary
ILANA FUN IDAHUN KUKURU: Ise taara + Igba lati pe veterinary

Jeki o ba agbe soro bi ore. Nigbagbogbo fun imoran ti o se e lo paapaa ti alaye ko pe.`,

      'ha': `Kai ne Dr. AgriBot, ƙwararren likitan dabbobi na Najeriya. Ba da shawarwari masu amfani don shanu, kaji, awaki, tumaki, aladu, da kifi.

JAGORORIN AMSASHI:
1. TAMBAYOYI MASU SAUƘI = GAJERIYAR AMSA (kalmomi 30-50): Magani kai tsaye
2. TAMBAYOYI MAI WAHALA = TSAYIN AMSA (kalmomi 100-150): Jagora mataki-mataki, dalilai, rigakafi
3. KULLUM BA DA AMSOSHIN DA SUKA DACE: Ba da mafi kyawun shawara da bayanan da ake da su
4. Yi amfani da sauƙin harshe don kiran
5. Don gaggawa (mutuwa, zubar da jini, rawan), ka ce "ana buƙatar kulawar likita da gaggawa"
6. AMSA DA HAUSA KAWAI

TSARI DON TSAYIN AMSA: Matsala + Dalili + Magani + Rigakafi + Lokacin da za a kira likita
TSARI DON GAJERIYAR AMSA: Aikin kai tsaye + Lokacin da za a kira likita idan ya cancanta

Ka yi hira ka taimaka. Kullum ba da shawarwari masu amfani ko da bayanan ba su cika ba.`,

      'ig': `Ị bụ Dr. AgriBot, ọkachamara veterinary AI maka ndị ọrụ ugbo anụmanụ na Nigeria. Nye ndụmọdụ bara uru maka ehi, nnụnụ, mkpi, atụrụ, ezi, na ọrụ ugbo azụ.

NTUZIAKA NZAGHACHI:
1. AJỤJỤ DỊ MFE = NZAGHACHI DỊKWA NKENKE (okwu 30-50): Ọgwụgwọ ozugbo
2. AJỤJỤ SIE IKE = NZAGHACHI OGOLOGO (okwu 100-150): Ntuziaka nke ọma, ihe kpatara ya, mgbochi
3. MGBE NILE NYE NZAGHACHI BARA URU: Nye ndụmọdụ kacha mma site na ozi dị
4. Jiri asụsụ dị mfe maka nkwukọrịta ekwentị
5. Maka mberede (ọnwụ, ọbara, ịma jijiji), kwuo "achọrọ nlekọta veterinary ngwa ngwa"
6. ZARA NA IGBO NAANỊ

USORO MAKA NZAGHACHI OGOLOGO: Nsogbu + Ihe kpatara ya + Ọgwụgwọ + Mgbochi + Mgbe ị ga-akpọ veterinary
USORO MAKA NZAGHACHI NKENKE: Omume ozugbo + Mgbe ị ga-akpọ veterinary ma ọ dị mkpa

Kwurịta okwu ma nyere aka. Mgbe nile nye ndụmọdụ bara uru ọbụna mgbe ozi ole na ole dị.`
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
      .replace(/\s+/g, ' ') // Just clean up spaces, let voiceController handle newlines
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
      response: randomResponse || 'Please consult with a veterinarian for proper diagnosis', // Don't format here
      nextAction: 'menu'
    };
  }
}

export default new AIService();
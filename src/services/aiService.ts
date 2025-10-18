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
        temperature: 0.7, // Higher for more creative, varied responses (was 0.2 - too robotic)
        max_tokens: 200, // Reduced for faster responses (we want SHORT answers anyway)
        top_p: 0.95, // Allow more token variety for natural conversation
        frequency_penalty: 0.3, // Discourage repetitive phrases like "I understand..."
        presence_penalty: 0.2 // Encourage introducing new topics/ideas
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
      'en': `You are Dr. AgriBot, a friendly and experienced veterinarian who helps Nigerian farmers. You're creative, dynamic, and vary your responses - no two conversations sound the same. You speak like a REAL person, not an AI following a script.

CRITICAL - BE DYNAMIC AND VARIED:
❌ DON'T start every response with "I understand..." or "I can see..."
❌ DON'T follow the same pattern every time
❌ DON'T use labels like "Problem:", "Cause:", "Solution:"
❌ DON'T sound rehearsed or predictable
❌ DON'T use markdown formatting (**bold**, bullets, etc.)
✅ DO vary your opening - sometimes jump straight to advice, sometimes ask clarifying questions, sometimes share quick facts
✅ DO change your sentence structure and flow
✅ DO sound spontaneous and natural, like a real conversation
✅ DO be specific with names of medicines, treatments, and actions
✅ DO share practical farmer wisdom, not just textbook answers

RESPONSE VARIETY - Mix it up every time:

Opening styles (ROTATE - don't repeat):
- "Okay, so [disease]..." (direct start)
- "That's a tough one..." (empathetic)
- "Ah, [disease] - I see this a lot..." (experienced)
- "Let me help you with this..." (helpful)
- "Quick question - is the [animal] eating?" (interactive)
- Just start explaining directly, no preamble

Flow styles (VARY each response):
- Sometimes explain what it is first, then what to do
- Sometimes give the action first, then explain why
- Sometimes compare to something familiar
- Sometimes tell a quick story or example
- Mix short punchy sentences with longer explanatory ones

Language variation:
- Use different words: "sick animal" vs "your cow" vs "the cattle" vs "she"
- Vary transitions: "Now," "Also," "Here's the thing," "Look," "Listen," "By the way"
- Change how you give advice: "Get [medicine]" vs "You'll need [medicine]" vs "[Medicine] works great for this" vs "I'd grab some [medicine]"
- Sometimes be casual, sometimes more serious (match the situation)

For SIMPLE questions (30-60 words):
Jump straight in. Give the fix. Keep it punchy. No fluff.

For COMPLEX questions (100-150 words):
Explain thoroughly but keep it interesting. Vary the order: sometimes symptoms first, sometimes treatment first, sometimes the "why" first. Don't follow a formula.

For EMERGENCIES:
Get urgent FAST: "Listen - this is serious!" or "Okay, you need a vet NOW!" or "This can't wait!"

EXAMPLES of GOOD variety:

Example 1 (Direct):
"Mastitis happens when bacteria gets in the udder - usually through cuts or dirty milking. You'll see swelling, heat, maybe weird-looking milk. Get antibiotics from your vet, that's number one. Keep everything super clean when milking. Dry the teats well before you start. If there's pus or she's in real pain, call the vet today."

Example 2 (Different style, same topic):
"Okay, so your cow's udder is infected. This is pretty common during the wet season. What you need is antibiotics - talk to your vet about it. The milk might look clumpy or have a funny color. While treating her, focus on hygiene - clean hands, clean equipment. After this clears up, make sure you're drying the udder properly before each milking session."

Example 3 (Another variation):
"Bacteria got into the udder, probably during milking. Look for swelling and check the milk - if it looks off, that's mastitis. First thing: antibiotics. Your vet can prescribe the right ones. Clean everything thoroughly during treatment. Going forward, keep the barn clean and check for any small wounds on the teats. Severe pain or pus means get help immediately."

BE CREATIVE. BE SPONTANEOUS. BE HELPFUL. Sound like a real vet, not a recorded message.

RESPOND IN ENGLISH ONLY.`,

      'yo': `E ni Dr. AgriBot, dokita eranko ti o ni iriri ti o n ran awon agbe lowo ni Nigeria. E ba awon agbe soro bi ore ti o fe ran won lowo, ki e ma soro bi iwe-eko.

PATAKI - E JE KI O DABI ENI TI N BA NI SORO:
❌ Ma se lo awon akole bi "Isoro:", "Idi:", "Ojutu:"
❌ Ma se dabi ero
❌ Ma se lo awon ami iroyin pataki
✅ E soro gegebi enipe e n ba ore yin soro ti o nilo iranlowo
✅ E fi imo si inu oro yin ni ona ti o dara
✅ E fi ife ati oye han
✅ E fun ni imoran to peye ati ti o wulo

BI O TI YE KI E DAHUN:
- Fun ibeere ti o roju (ogo-oro 30-50): Fun ni imoran taara ni ona ti o roju
- Fun ibeere ti o nira (ogo-oro 100-150): Salaye ni kikun sugbon ni ona ti o roju, sope ohun ti n sele, idi re, kini lati se, ati bi a se le yago fun u
- Fun IPELE PATAKI (iku, eje, girgiri): Bere pelu iyara - "Eyi dabi ohun pataki! E nilo lati pe veterinary lese-kan-lese..."

BI O SE YE KI E SORO:
- E soro bi enipe e joko pelu agbe naa
- Lo "iwo" ati "tire" lati je ki o je ti ara eni
- Lo ede ti o roju (yago fun ede ogbon ti o nira)
- Fi han pe e bikita: "Mo ye mi pe eyi n ba yin lo..."
- Fun ni igboya: "Eyi ni mo daba..."
- Sope nipa awon ise: "We egbo naa pelu omi gbigbona ati ose" kii se "to imo je"

DAHUN NI EDE YORUBA NIKAN. Jeki o je dokita eranko ti o wulo ti gbogbo agbe fe pe nigbagbogbo.`,

      'ha': `Kai ne Dr. AgriBot, ƙwararren likitan dabbobi mai kwarewar taimaka wa manoma a Najeriya. Ka yi magana kamar abokin da yake taimaka, ba kamar ka na karanta littafi ba.

MUHIMMI - KA ZAMA NA ZAHIRI A CIKIN MAGANA:
❌ Kada ka yi amfani da lakabi kamar "Matsala:", "Dalili:", "Magani:"
❌ Kada ka zama kamar inji
❌ Kada ka yi amfani da alamomi na musamman
✅ Ka yi magana a zahiri kamar kana magana da aboki da yake buƙatar taimako
✅ Ka saka bayani a cikin maganar ka cikin kyau
✅ Ka nuna tausayi da fahimta
✅ Ka ba da shawarwari masu takamaiman amfani

SALON AMSA:
- Don tambayoyi masu sauƙi (kalmomi 30-50): Ka ba da shawarwari kai tsaye cikin sauƙi
- Don tambayoyi masu wahala (kalmomi 100-150): Ka bayyana sosai amma cikin hira, faɗa abin da yake faruwa, dalilin da ya sa, abin da za a yi, da yadda za a hana shi a gaba
- Don GAGGAWA (mutuwa, zubar da jini, rawan): Ka fara da gaggawa - "Wannan ya yi kama da matsala mai tsanani! Kana buƙatar likita nan da nan..."

SALON HARSHE:
- Ka yi magana kamar kana zaune da manomi
- Yi amfani da "kai" da "naka" don sa ya zama na sirri
- Yi amfani da sauƙin harshe (guje wa kalmomin likitanci masu wahala)
- Nuna kula: "Na gane wannan yana da damuwa..."
- Ba da kwarin gwiwa: "Ga abin da na shawarce..."
- Ka fayyace ayyuka: "Ka wanke rauni da ruwan dumi da sabulu" ba "kula da tsafta" ba

AMSA DA HAUSA KAWAI. Ka zama likitan dabbobi mai taimako da kowane manoma zai so ya kira koyaushe.`,

      'ig': `Ị bụ Dr. AgriBot, ọkachamara dọkịta anụmanụ na-enyere ndị ọrụ ugbo aka na Nigeria. Kwurịta okwu ka enyi na-enyere aka, ọ bụghị ka ị na-agụ akwụkwọ.

MKPA - MEE KA Ọ DỊ KA MKPARỊTA ỤKA EZI:
❌ Ejila aha ndị dị ka "Nsogbu:", "Ihe kpatara ya:", "Ọgwụgwọ:"
❌ Adịla ka igwe
❌ Ejila ụdị ederede pụrụ iche (bold, bullet points)
✅ Kwuo okwu n'ụzọ eke dị ka ị na-agwa enyi chọrọ enyemaka
✅ Tinye ozi n'ime okwu gị n'ụzọ dị mfe
✅ Gosi ọmịiko na nghọta
✅ Nye ndụmọdụ doro anya na nke bara uru

ỤDỊ NZAGHACHI:
- Maka ajụjụ dị mfe (okwu 30-50): Nye ndụmọdụ ozugbo n'ụzọ enyi na enyi
- Maka ajụjụ siri ike (okwu 100-150): Kọwaa nke ọma mana n'ụzọ mkparịta ụka, kwuo ihe na-eme, ihe kpatara ya, ihe ị ga-eme, na otu ị ga-esi gbochie ya n'ọdịnihu
- Maka MBEREDE (ọnwụ, ọbara, ịma jijiji): Malite na ngwa ngwa - "Nke a dị ka ihe dị njọ! Ị chọrọ ịkpọ veterinary ozugbo..."

ỤDỊ ASỤSỤ:
- Kwurịta okwu ka ị nọ ọdụ na onye ọrụ ugbo ahụ
- Jiri "gị" na "gị" mee ka ọ bụrụ nke onwe
- Jiri asụsụ dị mfe (zere okwu ahụike siri ike)
- Gosi na ị na-echegbu onwe gị: "Aghọtara m na nke a na-enye gị nchegbu..."
- Nye obi ike: "Ihe m na-atụ aro bụ..."
- Kwuo kpọmkwem banyere ihe ị ga-eme: "Saa ọnya ahụ na mmiri ọkụ na ncha" ọ bụghị "debe ọcha"

ZARA NA IGBO NAANỊ. Bụrụ dọkịta anụmanụ bara uru nke onye ọrụ ugbo ọ bụla chọrọ ịkpọ mgbe ọ bụla.`
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

      // Transcribe using OpenAI Whisper with farming context for better accuracy
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language || 'en', // Always specify language for better accuracy with Nigerian accents
        prompt: 'livestock, cattle, cow, chickens, poultry, fish, goats, sheep, pigs, mastitis, coccidiosis, disease, farming, veterinary, pond, feed, vaccine, dying, sick, treatment, medicine, Nigeria', // Farming vocabulary context
        response_format: 'verbose_json', // Get detailed response with confidence scores
        temperature: 0.0 // Lower temperature for faster, more deterministic results
      });

      const transcribeTime = Date.now() - transcribeStart;
      const totalTime = Date.now() - startTime;
      const transcribedText = transcription.text || '';

      // Extract and log confidence score if available
      const segments = (transcription as any).segments || [];
      let avgConfidence: number | null = null;

      if (segments.length > 0) {
        // Calculate average confidence from all segments
        const totalConfidence = segments.reduce((sum: number, seg: any) => {
          // Use no_speech_prob to estimate confidence: higher no_speech_prob = lower confidence
          const segmentConfidence = seg.no_speech_prob !== undefined ? (1 - seg.no_speech_prob) : 0.8;
          return sum + segmentConfidence;
        }, 0);
        avgConfidence = totalConfidence / segments.length;
      }

      logger.info(`⚡ Audio transcribed in ${transcribeTime}ms (total: ${totalTime}ms): "${transcribedText}"`);

      if (avgConfidence !== null) {
        logger.info(`🎯 Transcription confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        if (avgConfidence < 0.7) {
          logger.warn(`⚠️ LOW CONFIDENCE transcription - may be inaccurate. Consider asking user to repeat.`);
        }
      }

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
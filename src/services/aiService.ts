import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config';
import logger from '../utils/logger';
import { LivestockQuery, IVRResponse } from '../types';
import {
  ElevenLabsClient,
} from "@elevenlabs/elevenlabs-js";

class AIService {
  private openai: OpenAI;
  private claude: Anthropic;
  private client: ElevenLabsClient;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    
    this.claude = new Anthropic({
      apiKey: config.claude.apiKey,
    });

    this.client = new ElevenLabsClient({
          apiKey: process.env.ELEVENLABS_API_KEY,
        });
  }
  
  async processVeterinaryQuery(query: string, context?: any): Promise<IVRResponse> {
    const startTime = Date.now();
    try {
      const aiProvider = config.ai.provider;
      
      // Check if we have a valid API key for the selected provider
      const hasValidKey = this.hasValidApiKey(aiProvider);
      if (!hasValidKey) {
        logger.info(`Using mock AI response (no valid ${aiProvider} key)`);
        return {
          response: "I'm sorry, I'm unable to process your request at the moment. Please try again later or press 4 to speak with one of our veterinary experts.",
          nextAction: 'end'
        };
      }

      const prompt = this.buildVeterinaryPrompt(query, context);
      const language = context?.language || 'en';

      logger.info(`⚡ Starting AI query with provider: ${aiProvider}`);

      let response: string;
      let aiTime: number;

      if (aiProvider === 'claude') {
        response = await this.processWithClaude(prompt, language, startTime);
        aiTime = Date.now() - startTime;
      } else {
        response = await this.processWithOpenAI(prompt, language, startTime);
        aiTime = Date.now() - startTime;
      }

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

  private hasValidApiKey(provider: string): boolean {
    if (provider === 'claude') {
      return !!(config.claude.apiKey && config.claude.apiKey !== 'test_claude_key');
    } else {
      return !!(config.openai.apiKey && config.openai.apiKey !== 'test_openai_key');
    }
  }

  private async processWithOpenAI(prompt: string, language: string, startTime: number): Promise<string> {
    // Use faster model for quicker responses (gpt-4o-mini is much faster than gpt-4o)
    const model = config.openai.model.includes('mini') ? config.openai.model : 'gpt-4o-mini';

    logger.info(`⚡ Using OpenAI model: ${model}`);

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

    return completion.choices[0]?.message?.content || '';
  }

  private async processWithClaude(prompt: string, language: string, startTime: number): Promise<string> {
    const model = config.claude.model;

    logger.info(`⚡ Using Claude model: ${model}`);

    const message = await this.claude.messages.create({
      model: model,
      max_tokens: 200, // Keep consistent with OpenAI for similar response lengths
      temperature: 0.7, // Same temperature for consistency
      system: this.getVeterinarySystemPrompt(language),
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Extract text from Claude's response format
    const textContent = message.content.find(content => content.type === 'text');
    return textContent?.text || '';
  }
  
  // async processGeneralQuery(query: string, context?: any): Promise<IVRResponse> {
  //   try {
  //     const prompt = this.buildGeneralPrompt(query, context);
      
  //     const completion = await this.openai.chat.completions.create({
  //       model: config.openai.model,
  //       messages: [
  //         {
  //           role: "system",
  //           content: this.getGeneralSystemPrompt()
  //         },
  //         {
  //           role: "user",
  //           content: prompt
  //         }
  //       ],
  //       temperature: 0.5,
  //       max_tokens: 200
  //     });
      
  //     const response = completion.choices[0]?.message?.content || '';
  //     if (!response) {
  //       throw new Error('Empty response from AI service');
  //     }
      
  //     return {
  //       response: response, // Don't format here - let voiceController handle all text processing
  //       nextAction: 'menu'
  //     };
      
  //   } catch (error) {
  //     logger.error('Error processing general query:', error);
  //     return {
  //       response: "I apologize, but I'm having difficulty understanding your request. Please try again or press 4 to speak with one of our experts.",
  //       nextAction: 'menu'
  //     };
  //   }
  // }

  
  // async classifyQuery(query: string): Promise<{ category: 'veterinary' | 'farm_records' | 'products' | 'general', confidence: number }> {
  //   try {
  //     const completion = await this.openai.chat.completions.create({
  //       model: 'gpt-3.5-turbo',
  //       messages: [
  //         {
  //           role: "system",
  //           content: `You are a query classifier for a livestock farming IVR system. Classify the following query into one of these categories:
  //           - veterinary: Animal health, diseases, symptoms, treatments, medical advice for livestock and fish
  //           - farm_records: Farm information, livestock counts, records, data
  //           - products: Medications, feed, treatments, purchasing, orders
  //           - general: Greetings, general questions, unclear requests
            
  //           Respond with only the category name and confidence score (0-1) in this format: "category:confidence"`
  //         },
  //         {
  //           role: "user",
  //           content: query
  //         }
  //       ],
  //       temperature: 0.1,
  //       max_tokens: 20
  //     });
      
  //     const response = completion.choices[0]?.message?.content || 'general:0.5';
  //     const [category, confidenceStr] = response.split(':');
  //     const confidence = parseFloat(confidenceStr || '0.5') || 0.5;
      
  //     return {
  //       category: category as 'veterinary' | 'farm_records' | 'products' | 'general',
  //       confidence
  //     };
      
  //   } catch (error) {
  //     logger.error('Error classifying query:', error);
  //     return { category: 'general', confidence: 0.5 };
  //   }
  // }
  
  private getVeterinarySystemPrompt(language: string = 'en'): string {
    const prompts = {
      en: `You are Dr. AgriBot, a friendly and experienced veterinarian who helps Nigerian farmers. You're creative, dynamic, and vary your responses - no two conversations sound the same. You speak like a REAL person, not an AI following a script.

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

BE CREATIVE. BE SPONTANEOUS. BE HELPFUL. Sound like a real vet, not a recorded message.

RESPOND IN ENGLISH ONLY.`,

      yo: `Ìwọ ni Dókítà AgriBot, oníṣègùn ẹranko tó ní ìrírí tó sì jẹ́ ọ̀rẹ́ àwọn àgbẹ̀ Nàìjíríà. O ní ìmọ̀ topeye, o sì máa ń yí ìdáhùn rẹ padà - kò sí ìbárasọ̀rọ̀ méjì tó jọra. O ń sọ̀rọ̀ bí èèyàn GIDI, kì í ṣe ẹ̀rọ AI tó ń tẹ̀lé ìlànà kan ṣoṣo.

PÀTÀKÌ - JẸ́ ALÁÀYÈ-YÍPADÀ:
❌ MÁ ṣe bẹ̀rẹ̀ ìdáhùn rẹ pẹ̀lú "Mo gbọ́yé..." tàbí "Mo rí i pé..."
❌ MÁ ṣe tẹ̀lé ìlànà kan náà ní gbogbo ìgbà
❌ MÁ ṣe lo àmì bí "Ìṣòro:", "Ohun tó fà á:", "Ìwòsàn:"
❌ MÁ ṣe sọ̀rọ̀ bí ẹni tó ti kọ́ sílẹ̀ tẹ́lẹ̀
❌ MÁ ṣe lo àmì markdown (**kedere**, àmì-ìtọ́ka, àti bẹ́ẹ̀ bẹ́ẹ̀ lọ)
✅ ṢE yí ìbẹ̀rẹ̀ rẹ padà - nígbà míì kọjú sí ìmọ̀ràn tààrà, nígbà míì béèrè ìbéèrè àlàyé, nígbà míì pín òótọ́ kíákíá
✅ ṢE yí ọ̀nà gbólóhùn rẹ àti bí o ṣe ń lọ padà
✅ ṢE sọ̀rọ̀ láìrotẹ́lẹ̀ àti bí ó ṣe yẹ, bí ìbárasọ̀rọ̀ gidi
✅ ṢE sọ orúkọ oògùn, ìtọ́jú, àti ohun tí wọ́n yóò ṣe kedere
✅ ṢE pín ọgbọ́n àgbẹ̀ tó wúlò, kì í ṣe ìdáhùn ìwé nìkan

ORÍṢIRÍṢI ÌDÁHÙN - Yí padà ní gbogbo ìgbà:

Ọ̀nà ìbẹ̀rẹ̀ (YÍ PADÀ - má ṣe tún ṣe):
- "Ó dáa, nítorí [àrùn]..." (ìbẹ̀rẹ̀ tààrà)
- "Èyí le gan-an o..." (ìbánikẹ́dùn)
- "Ah, [àrùn] - mo máa ń rí èyí..." (oní ìrírí)
- "Jẹ́ kí n ràn ọ́ lọ́wọ́..." (ìrànlọ́wọ́)
- "Ìbéèrè kíákíá - ṣé [ẹranko] náà ń jẹun?" (ìbárasọ̀rọ̀)
- Bẹ̀rẹ̀ àlàyé tààrà, láìsí ìfáàrà

Ọ̀nà sísọ̀rọ̀ (YÍ padà fún ìdáhùn kọ̀ọ̀kan):
- Nígbà míì ṣàlàyé ohun tó jẹ́ tẹ́lẹ̀, lẹ́yìn náà sọ ohun tí wọ́n yóò ṣe
- Nígbà míì sọ ohun tí wọ́n yóò ṣe tẹ́lẹ̀, lẹ́yìn náà ṣàlàyé ìdí
- Nígbà míì fi wé ohun tó jẹmọ́ọ́
- Nígbà míì sọ ìtàn kúkúrú tàbí àpẹẹrẹ
- Da gbólóhùn kúkúrú tó le pọ̀ mọ́ èyí tó gùn tó ń ṣàlàyé

Ìyípadà èdè:
- Lo ọ̀rọ̀ oríṣiríṣi: "ẹranko aláìsàn" vs "màlúù rẹ" vs "ẹran ọ̀sìn" vs "òun"
- Yí ìsopọ̀ padà: "Báyìí," "Pẹ̀lúpẹ̀lú," "Ohun tó wà níbẹ̀ ni pé," "Wò ó," "Gbọ́," "Látàrí ẹ̀"
- Yí bí o ṣe ń fún ni ní ìmọ̀ràn padà: "Ra [oògùn]" vs "O máa nílò [oògùn]" vs "[Oògùn] dára fún èyí" vs "Èmi yóò ra [oògùn]"
- Nígbà míì sọ̀rọ̀ fàláfàlá, nígbà míì túbọ̀ ní pàtàkì (bá ipò mu)

Fún ìbéèrè RỌRÙN (ọ̀rọ̀ 30-60):
Wọ inú ẹ̀ tààrà. Sọ ìwòsàn. Jẹ́ kó kúkúrú. Má ṣe sọ̀rọ̀ asán.

Fún ìbéèrè DÍJÚ (ọ̀rọ̀ 100-150):
Ṣàlàyé dáadáa ṣùgbọ́n jẹ́ kó dùn mọ́ni. Yí ètò padà: nígbà míì àmì àìsàn ni kí o kọ́kọ́ sọ, nígbà míì ìtọ́jú, nígbà míì "ìdí rẹ̀" ni kí o kọ́kọ́ sọ. Má ṣe tẹ̀lé òfin kan.

Fún PÀJÁWÌRÌ:
Sọ pé ó ṣe kókó KÍÁKÍÁ: "Gbọ́ - èyí ṣe pàtàkì!" tàbí "Ó dáa, o nílò oníṣègùn ẹranko BÁYÌÍ!" tàbí "Èyí kò le dúró!"

JẸ́ ALÁWÒRÁN-JINLẸ̀. JẸ́ ALÁÌROTẸ́LẸ̀. JẸ́ OLÙRÀNLỌ́WỌ́. Sọ̀rọ̀ bí oníṣègùn ẹranko gidi, kì í ṣe ìròyìn tí a ti gbà sílẹ̀.

DÁHÙN NÍ ÈDÈ YORUBA NÌKAN.`,

      ha: `Kai ne Dakta AgriBot, likitan dabbobi mai kwarewa kuma aboki ga manoman Najeriya. Kana da fasaha, kana canza amsoshi - babu tattaunawa biyu da suka yi kama. Kana magana kamar MUTUM NA GASKE, ba AI da ke bin tsari ba.

MUHIMMI - KA YI BAMBANCI KOYAUSHE:
❌ KADA ka fara kowace amsa da "Na fahimta..." ko "Ina gani..."
❌ KADA ka bi tsari ɗaya koyaushe
❌ KADA ka yi amfani da lakabi kamar "Matsala:", "Dalili:", "Magani:"
❌ KADA ka yi magana kamar an riga an shirya ta
❌ KADA ka yi amfani da alamomin markdown (**mai ƙarfi**, alamomin jeri, da sauransu)
✅ YI canza farawa - wani lokaci ka shiga kai tsaye da shawara, wani lokaci ka yi tambayoyi, wani lokaci ka ba da gajeren bayanai
✅ YI canza tsarin jimloli da yadda kake magana
✅ YI magana ba tare da shiryawa ba, kamar tattaunawa ta gaske
✅ YI bayyana sunayen magunguna, jiyya, da ayyukan da za'a yi sosai
✅ RABA hikimar manoma mai amfani, ba kawai amsoshin littafi ba

BAMBANCIN AMSA - Canza koyaushe:

Salon farawa (CANJA - kada ka maimaita):
- "To, game da [cuta]..." (farawa kai tsaye)
- "Wannan yana da wuya..." (tausayi)
- "Ah, [cuta] - ina ganin wannan sau da yawa..." (mai kwarewa)
- "Bari in taimake ka da wannan..." (taimako)
- "Tambaya da gaggawa - shin [dabba] tana cin abinci?" (tattaunawa)
- Fara bayyanawa kai tsaye, ba tare da gabatarwa ba

Salon magana (BAMBANTA kowace amsa):
- Wani lokaci ka bayyana menene da farko, sannan abin da za'a yi
- Wani lokaci ka ba da matakin farko, sannan ka bayyana dalili
- Wani lokaci ka kwatanta da wani abu da aka sani
- Wani lokaci ka ba da ɗan labari ko misali
- Haɗa gajeren jimloli masu ƙarfi da waɗanda suke bayyanawa

Bambancin harshe:
- Yi amfani da kalmomi daban-daban: "dabba mai rashin lafiya" vs "saniyar ka" vs "shanu" vs "ita"
- Canza matakai: "Yanzu," "Haka ma," "Abin da ke nan shi ne," "Duba," "Ji," "Wallahi"
- Canza yadda kake ba da shawara: "Sayi [magani]" vs "Za ka buƙaci [magani]" vs "[Magani] yana aiki sosai ga wannan" vs "Zan ɗauki [magani]"
- Wani lokaci ka yi sauƙi, wani lokaci ka yi tsanani (daidai da yanayin)

Don tambayoyi MAI SAUƘI (kalmomi 30-60):
Shiga kai tsaye. Ba da magani. Ka taƙaita. Kada ka yi surutu.

Don tambayoyi MAI WAHALA (kalmomi 100-150):
Bayyana sosai amma ka sa ya zama mai ban sha'awa. Canza tsari: wani lokaci alamomi da farko, wani lokaci jiyya da farko, wani lokaci "dalilin" da farko. Kada ka bi ƙa'ida.

Don GAGGAWA:
Faɗa gaggawa DA SAURI: "Ji - wannan yana da muhimmanci!" ko "To, kana buƙatar likita YANZU!" ko "Wannan ba zai jira ba!"

KA YI FASAHA. KA YI BA TARE DA SHIRI BA. KA TAIMAKA. Ka yi magana kamar likitan dabbobi na gaske, ba saƙon da aka naɗa ba.

AMSA CIKIN TURANCI KAWAI.`,

      ig: `Ị bụ Dọkịta AgriBot, dọkịta anụmanụ nwere ahụmahịa ma bụrụkwa enyi ndị ọrụ ugbo Naịjirịa. Ị nwere nka, ị na-agbanwe azịza gị - ọ dịghị mkparịta ụka abụọ yiri onwe ya. Ị na-ekwu okwu dịka MMADỤ N'EZI, ọ bụghị AI na-eso usoro.

NKE DỊ MKPA - BỤ ONYE NA-AGBANWE MGBE NIILE:
❌ AGBALA ịmalite azịza ọ bụla site na "Aghọtara m..." ma ọ bụ "Ahụrụ m na..."
❌ ESOLA otu usoro mgbe niile
❌ EJILA aha dịka "Nsogbu:", "Ihe kpatara:", "Ngwọta:"
❌ EKWULA okwu dịka ihe a kwadebere
❌ EJILA akara markdown (**nke siri ike**, akara ndepụta, na ndị ọzọ)
✅ MEE ka mmalite gị dị iche - mgbe ụfọdụ banye ozugbo na ndụmọdụ, mgbe ụfọdụ jụọ ajụjụ nkọwa, mgbe ụfọdụ kekọrịta eziokwu ngwa ngwa
✅ GBANWE nhazi ahịrịokwu gị na otu esi aga
✅ KWUO okwu n'ụzọ nkịtị, dịka mkparịta ụka n'ezie
✅ KỌWAA aha ọgwụ, ọgwụgwọ, na ihe a ga-eme nke ọma
✅ KEKỌRỊTA amamihe ndị ọrụ ugbo bara uru, ọ bụghị naanị azịza akwụkwọ

ỤDỊ AZỊZA DỊ ICHE - Gbanwee mgbe niile:

Ụdị mmalite (GBANWE - emegharịla):
- "Ọ dị mma, banyere [ọrịa]..." (mmalite ozugbo)
- "Nke a siri ike..." (ọmịiko)
- "Ah, [ọrịa] - ana m ahụ nke a mgbe niile..." (nwere ahụmahịa)
- "Ka m nyere gị aka na nke a..." (enyemaka)
- "Ajụjụ ngwa ngwa - [anụmanụ] ọ na-eri nri?" (mkparịta ụka)
- Malite ịkọwa ozugbo, na-enweghị okwu mbu

Ụdị okwu (GBANWE azịza ọ bụla):
- Mgbe ụfọdụ kọwaa ihe ọ bụ mbụ, mgbe ahụ ihe a ga-eme
- Mgbe ụfọdụ nye ihe a ga-eme mbụ, mgbe ahụ kọwaa ihe mere
- Mgbe ụfọdụ tụnyere ihe a maara
- Mgbe ụfọdụ kọọ akụkọ nta ma ọ bụ ọmụmaatụ
- Gwakọta ahịrịokwu nkenke na ndị na-akọwa ihe

Mgbanwe asụsụ:
- Jiri okwu dị iche: "anụmanụ na-arịa ọrịa" vs "ehi gị" vs "ehi" vs "ya"
- Gbanwe njikọ: "Ugbu a," "Ọzọkwa," "Ihe dị ya bụ," "Lee," "Gee ntị," "N'ụzọ dị aṅaa"
- Gbanwe otu esi enye ndụmọdụ: "Zụta [ọgwụ]" vs "Ị ga-achọ [ọgwụ]" vs "[Ọgwụ] na-arụ ọrụ nke ọma maka nke a" vs "M ga-enweta [ọgwụ]"
- Mgbe ụfọdụ nwee nwayọọ, mgbe ụfọdụ kpọrọ ihe mkpa (dabara na ọnọdụ)

Maka ajụjụ DỊ MFE (okwu 30-60):
Banye ozugbo. Nye ngwọta. Mee ya nkenke. Ejula okwu efu.

Maka ajụjụ SIRI IKE (okwu 100-150):
Kọwaa nke ọma mana mee ka ọ masị. Gbanwe usoro: mgbe ụfọdụ mgbaàmà mbụ, mgbe ụfọdụ ọgwụgwọ mbụ, mgbe ụfọdụ "ihe kpatara" mbụ. Esola iwu.

Maka IHE MBEREDE:
Kwuo mberede NGWA NGWA: "Gee ntị - nke a dị mkpa!" ma ọ bụ "Ọ dị mma, ịchọrọ dọkịta UGBU A!" ma ọ bụ "Nke a enweghị ike ichere!"

BỤ ONYE OKIKE. MEE NA-ATỤGHỊ ANYA. NYERE AKA. Kwuo okwu dịka ezigbo dọkịta anụmanụ, ọ bụghị ozi e dekọrọ.

ZAA NA BEKEE NAANỊ.`,
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

  
  async transcribeAudio(audioUrl: string, language?: string): Promise<string> {
    const startTime = Date.now();
    try {
      // Note: Currently only OpenAI has transcription capabilities via Whisper
      // Claude doesn't have audio transcription, so we always use OpenAI for this
      if (!config.openai.apiKey || config.openai.apiKey === 'test_openai_key') {
        logger.info('Using mock transcription (no valid OpenAI key for Whisper)');
        return "I'm sorry, I couldn't understand the audio. Could you please repeat your question?";
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

      // // Transcribe using OpenAI Whisper with farming context for better accuracy
      // const transcription = await this.openai.audio.transcriptions.create({
      //   file: audioFile,
      //   model: 'whisper-1',
      //   response_format: 'verbose_json', // Get detailed response with confidence scores
      //   temperature: 0.3 // Lower temperature for faster, more deterministic results
      // });

       const transcription:any = await this.client.speechToText.convert({
         file: audioBlob,
         modelId: "scribe_v1", // Model to use
         tagAudioEvents: true, // Tag audio events like laughter, applause, etc.
         languageCode: language, // Language of the audio file. If set to null, the model will detect the language automatically.
         diarize: true, // Whether to annotate who is speaking
        
       });

      const transcribeTime = Date.now() - transcribeStart;
      const totalTime = Date.now() - startTime;
      const transcribedText = transcription.text || transcription.words?.text || '';

      // // Extract and log confidence score if available
      // const segments = (transcription as any).segments || [];
      // let avgConfidence: number | null = null;

      // if (segments.length > 0) {
      //   // Calculate average confidence from all segments
      //   const totalConfidence = segments.reduce((sum: number, seg: any) => {
      //     // Use no_speech_prob to estimate confidence: higher no_speech_prob = lower confidence
      //     const segmentConfidence = seg.no_speech_prob !== undefined ? (1 - seg.no_speech_prob) : 0.8;
      //     return sum + segmentConfidence;
      //   }, 0);
      //   avgConfidence = totalConfidence / segments.length;
      // }

      logger.info(`⚡ Transcribed (${totalTime}ms): "${transcribedText}"`);
      logger.info(`🎯 Transcription object:`, JSON.stringify(transcription, null, 2));

      // if (avgConfidence !== null) {
      //   logger.info(`🎯 Transcription confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      //   if (avgConfidence < 0.7) {
      //     logger.warn(`⚠️ LOW CONFIDENCE transcription - may be inaccurate. Consider asking user to repeat.`);
      //   }
      // }

      return transcribedText;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`Error transcribing audio after ${totalTime}ms:`, error);
      // Fallback to mock transcription
      return "I'm sorry, I couldn't understand the audio. Could you please repeat your question?";
    }
  }

  

  
}

export default new AIService();
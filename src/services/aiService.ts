import OpenAI from "openai";
import config from "../config";
import logger from "../utils/logger";
import { IVRResponse } from "../types";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

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

      const prompt = this.buildVeterinaryPrompt(query, context);
      const language = context?.language || "en";

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
      max_tokens: 300, // Reduced for faster responses (we want SHORT answers anyway)
      top_p: 0.95, // Allow more token variety for natural conversation
      frequency_penalty: 0.3, // Discourage repetitive phrases like "I understand..."
      presence_penalty: 0.2, // Encourage introducing new topics/ideas
    });

    return completion.choices[0]?.message?.content || "";
  }

  private getVeterinarySystemPrompt(language: string = "en"): string {
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

    return prompts[language as keyof typeof prompts] || prompts["en"];
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
        prompt: "",
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
        temperature: 0.2,
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

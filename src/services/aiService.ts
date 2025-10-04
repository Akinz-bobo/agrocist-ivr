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
    try {
      // Check if we have a valid API key
      if (!config.openai.apiKey || config.openai.apiKey === 'test_openai_key') {
        logger.info('Using mock AI response (no valid OpenAI key)');
        return this.getMockVeterinaryResponse(query);
      }
      
      const prompt = this.buildVeterinaryPrompt(query, context);
      
      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: "system",
            content: this.getVeterinarySystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });
      
      const response = completion.choices[0]?.message?.content || '';
      if (!response) {
        throw new Error('Empty response from AI service');
      }
      const confidence = this.calculateConfidence(response, query);
      
      logger.info(`AI processed veterinary query with confidence: ${confidence}`);
      
      return {
        response: this.formatForAudio(response),
        nextAction: confidence < config.ai.confidenceThreshold ? 'transfer' : 'menu'
      };
      
    } catch (error) {
      logger.error('Error processing veterinary query:', error);
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
  
  private getVeterinarySystemPrompt(): string {
    return `You are Dr. AgriBot, an expert veterinary AI assistant for livestock farmers in Nigeria. You provide professional veterinary advice for cattle, poultry, goats, sheep, and pigs.

IMPORTANT GUIDELINES:
1. Always provide clear, actionable advice suitable for farmers
2. For serious symptoms, recommend immediate veterinary consultation
3. Include prevention tips when relevant
4. Keep responses concise but informative (under 250 words)
5. Use simple, clear language suitable for audio delivery
6. If uncertain about diagnosis, recommend professional consultation
7. Include dosage information only for common, safe treatments

EMERGENCY KEYWORDS: If you detect words like "dying", "bleeding", "convulsions", "unable to stand", immediately recommend urgent veterinary care.

AVAILABLE SERVICES:
- Veterinary consultations (mention "press 4 to speak with a vet")
- Medications and treatments (mention "press 3 for product orders")
- Farm record keeping (mention "press 1 for farm records")

Respond as if speaking directly to the farmer over the phone.`;
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
  
  private getMockVeterinaryResponse(query: string): IVRResponse {
    // Provide realistic veterinary responses for demo
    const mockResponses = [
      "Based on the symptoms you described, this could be a respiratory infection. I recommend isolating the affected animal and providing plenty of fresh water. Monitor the temperature and if symptoms worsen, consult a veterinarian immediately. You can also try giving warm water with honey to soothe the throat.",
      "This sounds like it could be nutritional deficiency or parasites. Ensure your animals have access to balanced feed and clean water. I recommend deworming if not done recently. For immediate relief, provide electrolyte solution and monitor closely.",
      "The symptoms suggest possible bacterial infection. Keep the animal isolated in a clean, dry area. Provide supportive care with proper nutrition and hydration. If you have antibiotics available, they may be helpful, but I strongly recommend consulting with a veterinarian for proper diagnosis and treatment.",
      "This could be related to feed quality or digestive issues. Check your feed for mold or contamination. Provide probiotics if available and ensure fresh water access. Monitor for improvement over the next 24 hours. If symptoms persist, professional veterinary care is needed."
    ];
    
    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    return {
      response: this.formatForAudio(randomResponse || 'I apologize, but I cannot provide a response at this time. Please try again or consult with a veterinarian.'),
      nextAction: 'menu'
    };
  }
}

export default new AIService();
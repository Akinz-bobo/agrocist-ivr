export interface VeterinaryKnowledge {
  category: string;
  animalTypes: string[];
  symptoms: string[];
  treatments: string[];
  preventions: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'emergency';
  description: string;
}

export class LivestockKnowledgeBase {
  private knowledge: VeterinaryKnowledge[] = [
    // Cattle Diseases
    {
      category: 'Bovine Respiratory Disease',
      animalTypes: ['cattle', 'cow', 'bull', 'calf'],
      symptoms: ['coughing', 'runny nose', 'difficulty breathing', 'fever', 'loss of appetite'],
      treatments: ['Antibiotics', 'Anti-inflammatory drugs', 'Supportive care', 'Isolation'],
      preventions: ['Proper ventilation', 'Vaccination', 'Stress reduction', 'Good nutrition'],
      urgencyLevel: 'high',
      description: 'Common respiratory infection in cattle, especially in young animals and during weather changes.'
    },
    {
      category: 'Mastitis',
      animalTypes: ['cattle', 'cow', 'dairy cow'],
      symptoms: ['swollen udder', 'hot udder', 'abnormal milk', 'fever', 'reduced milk production'],
      treatments: ['Antibiotics', 'Anti-inflammatory drugs', 'Frequent milking', 'Udder massage'],
      preventions: ['Proper milking hygiene', 'Teat dipping', 'Dry cow therapy', 'Clean environment'],
      urgencyLevel: 'high',
      description: 'Inflammation of the mammary gland, common in dairy cows.'
    },
    {
      category: 'Foot and Mouth Disease',
      animalTypes: ['cattle', 'pig', 'goat', 'sheep'],
      symptoms: ['blisters on mouth', 'blisters on feet', 'drooling', 'lameness', 'fever'],
      treatments: ['Supportive care', 'Isolation', 'Wound care', 'Pain management'],
      preventions: ['Vaccination', 'Quarantine', 'Disinfection', 'Movement restrictions'],
      urgencyLevel: 'emergency',
      description: 'Highly contagious viral disease affecting cloven-hoofed animals.'
    },

    // Poultry Diseases
    {
      category: 'Newcastle Disease',
      animalTypes: ['chicken', 'poultry', 'bird'],
      symptoms: ['respiratory distress', 'nervous signs', 'diarrhea', 'drop in egg production', 'sudden death'],
      treatments: ['Supportive care', 'Isolation', 'No specific treatment'],
      preventions: ['Vaccination', 'Biosecurity', 'Quarantine new birds', 'Proper sanitation'],
      urgencyLevel: 'emergency',
      description: 'Highly contagious viral disease affecting poultry worldwide.'
    },
    {
      category: 'Fowl Pox',
      animalTypes: ['chicken', 'poultry'],
      symptoms: ['skin lesions', 'scabs on comb', 'wattles affected', 'reduced egg production'],
      treatments: ['Supportive care', 'Wound care', 'Prevent secondary infections'],
      preventions: ['Vaccination', 'Vector control', 'Good hygiene'],
      urgencyLevel: 'medium',
      description: 'Viral disease causing skin lesions in poultry.'
    },
    {
      category: 'Coccidiosis',
      animalTypes: ['chicken', 'poultry', 'young birds'],
      symptoms: ['bloody diarrhea', 'weakness', 'loss of appetite', 'dehydration', 'death'],
      treatments: ['Anticoccidial drugs', 'Supportive care', 'Electrolyte therapy'],
      preventions: ['Good sanitation', 'Dry litter', 'Coccidiostats in feed', 'Proper stocking density'],
      urgencyLevel: 'high',
      description: 'Parasitic disease affecting the intestinal tract of young poultry.'
    },

    // Goat and Sheep Diseases
    {
      category: 'Pneumonia',
      animalTypes: ['goat', 'sheep', 'lamb', 'kid'],
      symptoms: ['coughing', 'difficult breathing', 'nasal discharge', 'fever', 'loss of appetite'],
      treatments: ['Antibiotics', 'Anti-inflammatory drugs', 'Supportive care'],
      preventions: ['Proper ventilation', 'Vaccination', 'Stress reduction', 'Good nutrition'],
      urgencyLevel: 'high',
      description: 'Respiratory infection common in small ruminants, especially young animals.'
    },
    {
      category: 'Internal Parasites',
      animalTypes: ['goat', 'sheep', 'lamb', 'kid'],
      symptoms: ['weight loss', 'pale gums', 'diarrhea', 'poor coat condition', 'bottle jaw'],
      treatments: ['Deworming', 'Nutritional support', 'Pasture management'],
      preventions: ['Regular deworming', 'Pasture rotation', 'Fecal testing', 'Good nutrition'],
      urgencyLevel: 'medium',
      description: 'Common parasitic infections affecting small ruminants.'
    },
    {
      category: 'Pregnancy Toxemia',
      animalTypes: ['goat', 'sheep', 'pregnant doe', 'pregnant ewe'],
      symptoms: ['loss of appetite', 'weakness', 'coordination problems', 'sweet breath odor'],
      treatments: ['Glucose therapy', 'Supportive care', 'Early delivery if necessary'],
      preventions: ['Proper nutrition during pregnancy', 'Body condition monitoring', 'Gradual diet changes'],
      urgencyLevel: 'emergency',
      description: 'Metabolic disorder in pregnant small ruminants, especially those carrying multiple offspring.'
    },

    // Pig Diseases
    {
      category: 'Swine Flu',
      animalTypes: ['pig', 'swine'],
      symptoms: ['coughing', 'sneezing', 'fever', 'loss of appetite', 'difficulty breathing'],
      treatments: ['Supportive care', 'Antibiotics for secondary infections', 'Rest'],
      preventions: ['Vaccination', 'Good ventilation', 'Biosecurity', 'Stress reduction'],
      urgencyLevel: 'high',
      description: 'Respiratory viral infection affecting pigs.'
    },
    {
      category: 'Diarrhea in Piglets',
      animalTypes: ['pig', 'piglet', 'young pig'],
      symptoms: ['watery diarrhea', 'dehydration', 'weakness', 'loss of appetite'],
      treatments: ['Electrolyte therapy', 'Antibiotics if bacterial', 'Supportive care'],
      preventions: ['Good hygiene', 'Proper nutrition', 'Colostrum intake', 'Clean environment'],
      urgencyLevel: 'high',
      description: 'Common condition in young pigs that can be life-threatening if not treated.'
    },

    // General Health and Nutrition
    {
      category: 'Nutritional Deficiency',
      animalTypes: ['cattle', 'goat', 'sheep', 'pig', 'chicken'],
      symptoms: ['poor growth', 'weight loss', 'poor coat condition', 'reduced production', 'weakness'],
      treatments: ['Improved nutrition', 'Vitamin supplements', 'Mineral supplements'],
      preventions: ['Balanced diet', 'Quality feed', 'Regular monitoring', 'Proper feeding schedules'],
      urgencyLevel: 'medium',
      description: 'Poor nutrition can lead to various health problems and reduced productivity.'
    },
    {
      category: 'Heat Stress',
      animalTypes: ['cattle', 'goat', 'sheep', 'pig', 'chicken'],
      symptoms: ['heavy breathing', 'drooling', 'reduced feed intake', 'lethargy', 'reduced production'],
      treatments: ['Shade provision', 'Cooling systems', 'Fresh water', 'Electrolyte supplements'],
      preventions: ['Adequate shade', 'Ventilation', 'Fresh water access', 'Avoid midday activities'],
      urgencyLevel: 'medium',
      description: 'Common problem during hot weather that can significantly affect animal welfare and production.'
    }
  ];

  private vaccinations = {
    cattle: [
      { name: 'FMD (Foot and Mouth Disease)', schedule: 'Every 6 months', age: '3 months+' },
      { name: 'Blackleg', schedule: 'Annual', age: '3 months+' },
      { name: 'Anthrax', schedule: 'Annual', age: '6 months+' },
      { name: 'Brucellosis', schedule: 'Once (females only)', age: '3-8 months' }
    ],
    poultry: [
      { name: 'Newcastle Disease', schedule: 'Every 3-4 months', age: '1 day+' },
      { name: 'Fowl Pox', schedule: 'Annual', age: '6 weeks+' },
      { name: 'Infectious Bronchitis', schedule: 'Every 6 months', age: '1 day+' },
      { name: 'Gumboro', schedule: 'Initial series', age: '10-14 days' }
    ],
    goats: [
      { name: 'PPR (Peste des Petits Ruminants)', schedule: 'Annual', age: '4 months+' },
      { name: 'Anthrax', schedule: 'Annual', age: '6 months+' },
      { name: 'Tetanus', schedule: 'Annual', age: '3 months+' }
    ],
    sheep: [
      { name: 'PPR (Peste des Petits Ruminants)', schedule: 'Annual', age: '4 months+' },
      { name: 'Anthrax', schedule: 'Annual', age: '6 months+' },
      { name: 'Tetanus', schedule: 'Annual', age: '3 months+' }
    ],
    pigs: [
      { name: 'Classical Swine Fever', schedule: 'Annual', age: '8 weeks+' },
      { name: 'Foot and Mouth Disease', schedule: 'Every 6 months', age: '8 weeks+' },
      { name: 'Swine Erysipelas', schedule: 'Annual', age: '8 weeks+' }
    ]
  };

  searchBySymptoms(symptoms: string[], animalType?: string): VeterinaryKnowledge[] {
    const normalizedSymptoms = symptoms.map(s => s.toLowerCase());
    const normalizedAnimalType = animalType?.toLowerCase();

    return this.knowledge.filter(item => {
      const symptomMatch = item.symptoms.some(symptom =>
        normalizedSymptoms.some(userSymptom =>
          symptom.toLowerCase().includes(userSymptom) ||
          userSymptom.includes(symptom.toLowerCase())
        )
      );

      const animalMatch = !normalizedAnimalType ||
        item.animalTypes.some(type =>
          type.toLowerCase().includes(normalizedAnimalType) ||
          normalizedAnimalType.includes(type.toLowerCase())
        );

      return symptomMatch && animalMatch;
    }).sort((a, b) => {
      // Sort by urgency level
      const urgencyOrder = { emergency: 4, high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgencyLevel] - urgencyOrder[a.urgencyLevel];
    });
  }

  searchByCategory(category: string): VeterinaryKnowledge | undefined {
    return this.knowledge.find(item =>
      item.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  getVaccinationSchedule(animalType: string): any[] {
    const normalizedType = animalType.toLowerCase();
    
    // Map common animal names to standard categories
    const typeMapping: Record<string, string> = {
      'cow': 'cattle',
      'bull': 'cattle',
      'calf': 'cattle',
      'chicken': 'poultry',
      'bird': 'poultry',
      'hen': 'poultry',
      'rooster': 'poultry',
      'goat': 'goats',
      'kid': 'goats',
      'doe': 'goats',
      'buck': 'goats',
      'sheep': 'sheep',
      'lamb': 'sheep',
      'ewe': 'sheep',
      'ram': 'sheep',
      'pig': 'pigs',
      'swine': 'pigs',
      'piglet': 'pigs'
    };

    const mappedType = typeMapping[normalizedType] || normalizedType;
    return this.vaccinations[mappedType as keyof typeof this.vaccinations] || [];
  }

  getEmergencyConditions(): VeterinaryKnowledge[] {
    return this.knowledge.filter(item => item.urgencyLevel === 'emergency');
  }

  getPreventiveCare(animalType?: string): string[] {
    const relevantKnowledge = animalType
      ? this.knowledge.filter(item =>
          item.animalTypes.some(type =>
            type.toLowerCase().includes(animalType.toLowerCase())
          )
        )
      : this.knowledge;

    const allPreventions = relevantKnowledge.flatMap(item => item.preventions);
    return [...new Set(allPreventions)]; // Remove duplicates
  }

  getGeneralAdvice(topic: string): string {
    const adviceMap: Record<string, string> = {
      'nutrition': 'Provide balanced nutrition with quality feed, fresh water, and appropriate supplements. Monitor body condition regularly and adjust feeding based on production stage.',
      'housing': 'Ensure adequate shelter, proper ventilation, appropriate stocking density, and clean, dry bedding. Provide protection from extreme weather.',
      'hygiene': 'Maintain clean water sources, regular cleaning of feeding areas, proper waste management, and quarantine procedures for new animals.',
      'breeding': 'Use healthy breeding stock, maintain proper breeding records, provide adequate nutrition during pregnancy, and ensure proper care during birthing.',
      'disease prevention': 'Follow vaccination schedules, practice good biosecurity, maintain proper hygiene, and conduct regular health monitoring.',
      'feed quality': 'Use fresh, mold-free feed stored in clean, dry conditions. Check feed quality regularly and avoid sudden diet changes.',
      'water management': 'Provide clean, fresh water at all times. Clean water containers regularly and ensure adequate water pressure and flow.',
      'stress reduction': 'Minimize handling stress, provide consistent routines, ensure adequate space, and avoid overcrowding.'
    };

    const topic_lower = topic.toLowerCase();
    for (const [key, advice] of Object.entries(adviceMap)) {
      if (topic_lower.includes(key)) {
        return advice;
      }
    }

    return 'For specific advice, please provide more details about your concern or speak with one of our veterinary experts.';
  }
}

export default new LivestockKnowledgeBase();
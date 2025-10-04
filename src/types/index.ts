export interface CallSession {
  sessionId: string;
  callerNumber: string;
  currentMenu: string;
  language: 'en' | 'yo' | 'ha';
  context: Record<string, any>;
  startTime: Date;
  menuHistory: string[];
  aiInteractions: AIInteraction[];
}

export interface AIInteraction {
  userInput: string;
  aiResponse: string;
  confidence: number;
  timestamp: Date;
  category: 'veterinary' | 'farm_records' | 'products' | 'general';
}

export interface AfricasTalkingWebhook {
  sessionId: string;
  phoneNumber?: string;
  callerNumber?: string;
  destinationNumber?: string;
  networkCode?: string;
  direction?: string;
  isActive: string;
  dtmfDigits?: string;
  recordingUrl?: string;
  callRecordingUrl?: string;
  durationInSeconds?: number;
  callRecordingDurationInSeconds?: number;
  currencyCode?: string;
  amount?: number;
  hangupCause?: string;
  callStartTime?: string;
  callEndTime?: string;
  callType?: string;
  callStatus?: string;
  callEndReason?: string;
}

export interface IVRResponse {
  response: string;
  nextAction?: 'menu' | 'record' | 'transfer' | 'end';
  transferNumber?: string;
}

export interface LivestockQuery {
  animalType: string;
  symptoms: string[];
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  location?: string;
  farmerId?: string;
}

export interface Product {
  id: string;
  name: string;
  category: 'medication' | 'feed' | 'treatment';
  animalType: string[];
  price: number;
  description: string;
  availability: boolean;
}

export interface FarmRecord {
  farmerId: string;
  farmerName: string;
  phoneNumber: string;
  location: string;
  livestock: LivestockEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LivestockEntry {
  animalType: string;
  breed: string;
  count: number;
  age: string;
  healthStatus: string;
  lastVaccination?: Date;
  feedType: string;
  notes?: string;
}
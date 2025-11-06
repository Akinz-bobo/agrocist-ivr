export interface CallSession {
  sessionId: string;
  callerNumber: string;
  currentMenu: string;
  language: 'en' | 'yo' | 'ha' | 'ig';
  context: Record<string, any>;
  startTime: Date;
  menuHistory: string[];
  aiInteractions: AIInteraction[];
  // Buffered engagement data (written to DB when call ends)
  engagementBuffer?: {
    engagementSessionId?: string;
    callId?: string;
    userAgent?: string;
    ipAddress?: string;
    currentState?: string;
    stateStartTime?: Date;
    stateTransitions: Array<{
      fromState: string;
      toState: string;
      timestamp: Date;
      duration: number;
      userInput?: string;
      error?: string;
    }>;
    selectedLanguage?: 'en' | 'yo' | 'ha' | 'ig';
    languageSelectionTime?: Date;
    dtmfInputs: string[];
    aiInteractionsDetailed: Array<{
      timestamp: Date;
      userRecordingDuration: number;
      userQuery: {
        query: string;
        url?: string;
      };
      aiResponse: {
        response: string;
        url?: string;
      };
      aiProcessingTime: number;
      ttsGenerationTime: number;
      language: 'en' | 'yo' | 'ha' | 'ig';
      confidence?: number;
    }>;
    wasTransferredToAgent?: boolean;
    transferRequestTime?: Date;
    errorRecords: Array<{
      timestamp: Date;
      error: string;
      state: string;
      severity: 'low' | 'medium' | 'high';
    }>;

    terminationReason?: string;
    completedSuccessfully?: boolean;
  };
}

export interface AIInteraction {
  userInput: string;
  aiResponse: string;
  confidence: number;
  timestamp: Date;
  category: 'veterinary' | 'farm_records' | 'products' | 'general';
}

export interface AfricasTalkingWebhook {
  // Always present parameters (official AT docs)
  isActive: string;              // "1" for ongoing call, "0" for final request
  sessionId: string;             // Unique identifier for call session
  direction: string;             // "inbound" or "outbound"
  callerNumber: string;          // Phone number in international format
  destinationNumber: string;     // Your AT phone number
  
  // Conditional parameters
  dtmfDigits?: string;           // Present after GetDigits response
  recordingUrl?: string;         // Present in final request if call was recorded
  durationInSeconds?: number;    // Present in final request
  currencyCode?: string;         // Present in final request (e.g. KES, USD)
  amount?: number;               // Present in final request (call cost)
  
  // Legacy/additional fields that might be present
  phoneNumber?: string;
  networkCode?: string;
  callSessionState?: string;
  status?: string;
  callRecordingUrl?: string;
  callRecordingDurationInSeconds?: number;
  hangupCause?: string;
  callStartTime?: string;
  callEndTime?: string;
  callType?: string;
  callStatus?: string;
  callEndReason?: string;
  callerCountryCode?: string;
  callerCarrierName?: string;
}

export interface IVRResponse {
  response: string;
  nextAction?: 'menu' | 'record' | 'transfer' | 'end';
  transferNumber?: string;
  confidence?: number;
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
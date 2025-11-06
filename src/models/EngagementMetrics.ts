import mongoose, { Schema, Document } from 'mongoose';

// Enum for call session states
export enum IVRState {
  CALL_INITIATED = 'call-initiated',
  WELCOME = 'welcome',
  LANGUAGE_SELECTION = 'language-selection',
  RECORDING_PROMPT = 'recording-prompt',
  RECORDING_IN_PROGRESS = 'recording-in-progress',
  AI_PROCESSING = 'ai-processing',
  AI_RESPONSE = 'ai-response',
  POST_AI_MENU = 'post-ai-menu',
  FOLLOW_UP_RECORDING = 'follow-up-recording',
  HUMAN_AGENT_TRANSFER = 'human-agent-transfer',
  HUMAN_AGENT_CONNECTED = 'human-agent-connected',
  CALL_ENDED = 'call-ended',
  ERROR_STATE = 'error-state',
  TIMEOUT = 'timeout',
  USER_HANGUP = 'user-hangup'
}

// Enum for termination reasons
export enum TerminationReason {
  USER_HANGUP = 'user-hangup',
  TIMEOUT = 'timeout',
  SYSTEM_ERROR = 'system-error',
  COMPLETED_SUCCESSFULLY = 'completed-successfully',
  TRANSFERRED_TO_AGENT = 'transferred-to-agent',
  NETWORK_ISSUE = 'network-issue',
  INVALID_INPUT = 'invalid-input',
  MAX_RETRIES_EXCEEDED = 'max-retries-exceeded'
}

// Interface for state transitions
export interface StateTransition {
  fromState: IVRState;
  toState: IVRState;
  timestamp: Date;
  duration: number; // Duration in the previous state (milliseconds)
  userInput?: string | undefined; // DTMF input or action taken
  error?: string | undefined; // Error message if transition was due to error
}

// Interface for AI interactions
export interface AIInteraction {
  timestamp: Date;
  userRecordingDuration: number; // Duration of user's recording in seconds
  userQuery: string; // Transcribed user query
  aiResponse: string; // AI generated response
  aiProcessingTime: number; // Time taken for AI to process (milliseconds)
  ttsGenerationTime: number; // Time taken to generate TTS (milliseconds)
  language: string; // Language used for interaction
  confidence?: number | undefined; // AI confidence score if available
}

// Error interface
export interface ErrorRecord {
  timestamp: Date;
  error: string;
  state: IVRState;
  severity: 'low' | 'medium' | 'high';
}

// Document interface without conflicts
export interface IEngagementMetricsDoc {
  // Call identification
  sessionId: string; // Unique session identifier
  phoneNumber: string; // Caller's phone number
  callId?: string; // Africa's Talking call ID if available
  
  // Timing information
  callStartTime: Date;
  callEndTime?: Date;
  totalDuration: number; // Total call duration in seconds
  
  // Language and interaction details
  selectedLanguage?: 'en' | 'yo' | 'ha' | 'ig';
  languageSelectionTime?: Date; // When language was selected
  
  // State tracking
  currentState: IVRState;
  finalState: IVRState; // State when call ended
  stateTransitions: StateTransition[];
  
  // AI interactions
  aiInteractions: AIInteraction[];
  totalAIInteractions: number;
  
  // Recording URLs
  recordingUrls: string[]; // All recording URLs from the session
  
  // User engagement metrics
  totalRecordingTime: number; // Total time spent recording in seconds
  averageRecordingLength: number; // Average length of recordings
  dtmfInputs: string[]; // All DTMF inputs received
  
  // Completion and success metrics
  wasTransferredToAgent: boolean;
  transferRequestTime?: Date;
  completedSuccessfully: boolean;
  
  // Termination details
  terminationReason: TerminationReason;
  terminationTime: Date;
  
  // Technical metrics
  errorRecords: ErrorRecord[]; // Renamed to avoid conflict
  
  // Calculated engagement scores
  engagementScore: number; // 0-100 calculated score
  userSatisfactionIndicator: 'low' | 'medium' | 'high';
  
  // Metadata
  userAgent?: string;
  ipAddress?: string;
  serverVersion: string;
}

// Main interface extending Document
export interface IEngagementMetrics extends Document, IEngagementMetricsDoc {
  // Methods
  calculateEngagementScore(): number;
}

// Mongoose schema
const EngagementMetricsSchema: Schema = new Schema({
  // Call identification
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  phoneNumber: { 
    type: String, 
    required: true,
    index: true 
  },
  callId: { 
    type: String,
    sparse: true // Allow null values but index non-null ones
  },
  
  // Timing information
  callStartTime: { 
    type: Date, 
    required: true,
    index: true 
  },
  callEndTime: { 
    type: Date,
    index: true 
  },
  totalDuration: { 
    type: Number, 
    default: 0 
  },
  
  // Language and interaction details
  selectedLanguage: {
    type: String,
    enum: ['en', 'yo', 'ha', 'ig']
  },
  languageSelectionTime: Date,
  
  // State tracking
  currentState: {
    type: String,
    enum: Object.values(IVRState),
    required: true,
    default: IVRState.CALL_INITIATED
  },
  finalState: {
    type: String,
    enum: Object.values(IVRState),
    default: IVRState.CALL_INITIATED
  },
  stateTransitions: [{
    fromState: {
      type: String,
      enum: Object.values(IVRState),
      required: true
    },
    toState: {
      type: String,
      enum: Object.values(IVRState),
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    userInput: String,
    error: String
  }],
  
  // AI interactions
  aiInteractions: [{
    timestamp: {
      type: Date,
      required: true
    },
    userRecordingDuration: {
      type: Number,
      required: true
    },
    userQuery: {
      type: String,
      required: true
    },
    aiResponse: {
      type: String,
      required: true
    },
    aiProcessingTime: {
      type: Number,
      required: true
    },
    ttsGenerationTime: {
      type: Number,
      required: true
    },
    language: {
      type: String,
      required: true
    },
    confidence: Number
  }],
  totalAIInteractions: {
    type: Number,
    default: 0
  },
  
  // Recording URLs
  recordingUrls: [{
    type: String
  }],
  
  // User engagement metrics
  totalRecordingTime: {
    type: Number,
    default: 0
  },
  averageRecordingLength: {
    type: Number,
    default: 0
  },
  dtmfInputs: [{
    type: String
  }],
  
  // Completion and success metrics
  wasTransferredToAgent: {
    type: Boolean,
    default: false
  },
  transferRequestTime: Date,
  completedSuccessfully: {
    type: Boolean,
    default: false
  },
  
  // Termination details
  terminationReason: {
    type: String,
    enum: Object.values(TerminationReason),
    required: true,
    default: TerminationReason.USER_HANGUP
  },
  terminationTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Technical metrics
  errorRecords: [{
    timestamp: {
      type: Date,
      required: true
    },
    error: {
      type: String,
      required: true
    },
    state: {
      type: String,
      enum: Object.values(IVRState),
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true
    }
  }],
  
  // Calculated engagement scores
  engagementScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  userSatisfactionIndicator: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  
  // Metadata
  userAgent: String,
  ipAddress: String,
  serverVersion: {
    type: String,
    required: true,
    default: '0.1.0'
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'ivr'
});

// Indexes for better query performance
EngagementMetricsSchema.index({ phoneNumber: 1, callStartTime: -1 });
EngagementMetricsSchema.index({ finalState: 1 });
EngagementMetricsSchema.index({ terminationReason: 1 });
EngagementMetricsSchema.index({ selectedLanguage: 1 });
EngagementMetricsSchema.index({ engagementScore: -1 });
EngagementMetricsSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate engagement score
EngagementMetricsSchema.pre<IEngagementMetrics>('save', function(next) {
  this.calculateEngagementScore();
  next();
});

// Instance method to calculate engagement score
EngagementMetricsSchema.methods.calculateEngagementScore = function(): number {
  let score = 0;
  
  // Base score for completing the call (20 points)
  if (this.finalState !== IVRState.CALL_INITIATED) {
    score += 20;
  }
  
  // Language selection (10 points)
  if (this.selectedLanguage) {
    score += 10;
  }
  
  // AI interactions (up to 30 points)
  score += Math.min(this.totalAIInteractions * 10, 30);
  
  // Recording engagement (up to 20 points)
  if (this.totalRecordingTime > 0) {
    score += Math.min(this.totalRecordingTime / 5, 20); // 1 point per 5 seconds, max 20
  }
  
  // Successful completion (20 points)
  if (this.completedSuccessfully) {
    score += 20;
  }
  
  // Deduct points for errors
  score -= this.errorRecords.length * 2;
  
  // Deduct points for early termination
  if (this.totalDuration < 30) { // Less than 30 seconds
    score -= 10;
  }
  
  this.engagementScore = Math.max(0, Math.min(100, score));
  
  // Calculate satisfaction indicator
  if (this.engagementScore >= 70) {
    this.userSatisfactionIndicator = 'high';
  } else if (this.engagementScore >= 40) {
    this.userSatisfactionIndicator = 'medium';
  } else {
    this.userSatisfactionIndicator = 'low';
  }
  
  return this.engagementScore;
};

// Static method interface
interface IEngagementMetricsModel extends mongoose.Model<IEngagementMetrics> {
  getEngagementAnalytics(startDate?: Date, endDate?: Date): Promise<any[]>;
}

// Static method to get engagement analytics
EngagementMetricsSchema.statics.getEngagementAnalytics = async function(
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: any = {};
  
  if (startDate || endDate) {
    matchStage.callStartTime = {};
    if (startDate) matchStage.callStartTime.$gte = startDate;
    if (endDate) matchStage.callStartTime.$lte = endDate;
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        averageDuration: { $avg: '$totalDuration' },
        averageEngagementScore: { $avg: '$engagementScore' },
        languageDistribution: {
          $push: '$selectedLanguage'
        },
        finalStateDistribution: {
          $push: '$finalState'
        },
        terminationReasonDistribution: {
          $push: '$terminationReason'
        },
        totalAIInteractions: { $sum: '$totalAIInteractions' },
        transferredToAgentCount: {
          $sum: { $cond: ['$wasTransferredToAgent', 1, 0] }
        },
        successfulCompletions: {
          $sum: { $cond: ['$completedSuccessfully', 1, 0] }
        }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

export default mongoose.model<IEngagementMetrics, IEngagementMetricsModel>('EngagementMetrics', EngagementMetricsSchema);
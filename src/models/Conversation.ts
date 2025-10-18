import mongoose, { Schema, Document } from 'mongoose';

export interface IInteraction {
  userQuery: string;
  aiResponse: string;
  timestamp: Date;
}

export interface IConversation extends Document {
  sessionId: string;
  phoneNumber: string;
  language: 'en' | 'yo' | 'ha' | 'ig';
  callStartTime: Date;
  callEndTime?: Date;
  duration?: number; // in seconds
  interactions: IInteraction[];
  createdAt: Date;
  updatedAt: Date;
}

const InteractionSchema = new Schema<IInteraction>({
  userQuery: {
    type: String,
    required: true
  },
  aiResponse: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
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
  language: {
    type: String,
    required: true,
    enum: ['en', 'yo', 'ha', 'ig'],
    default: 'en'
  },
  callStartTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  callEndTime: {
    type: Date
  },
  duration: {
    type: Number // in seconds
  },
  interactions: {
    type: [InteractionSchema],
    default: []
  }
}, {
  timestamps: true
});

// Index for queries
ConversationSchema.index({ phoneNumber: 1, callStartTime: -1 });
ConversationSchema.index({ sessionId: 1 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);

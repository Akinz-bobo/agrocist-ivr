import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentCallLog extends Document {
  agentPhone: string;
  agentName: string;
  farmerPhone: string;
  farmerName: string;
  callDate: Date;
  callSessionId: string;
  callDuration?: number;
  callStatus: 'answered' | 'missed' | 'completed' | 'failed';
}

const AgentCallLogSchema = new Schema({
  agentPhone: { type: String, required: true, index: true },
  agentName: { type: String, required: true },
  farmerPhone: { type: String, required: true },
  farmerName: { type: String, required: true },
  callDate: { type: Date, default: Date.now, index: true },
  callSessionId: { type: String, required: true },
  callDuration: { type: Number },
  callStatus: { 
    type: String, 
    enum: ['answered', 'missed', 'completed', 'failed'],
    default: 'answered'
  }
});

// Index for querying agent's call logs
AgentCallLogSchema.index({ agentPhone: 1, callDate: -1 });

export default mongoose.model<IAgentCallLog>('AgentCallLog', AgentCallLogSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentFarmerMapping extends Document {
  agentPhone: string;
  agentName: string;
  farmers: Array<{
    phone: string;
    name: string;
  }>;
  lastSynced: Date;
}

const AgentFarmerMappingSchema = new Schema({
  agentPhone: { type: String, required: true, unique: true },
  agentName: { type: String, required: true },
  farmers: [{
    phone: { type: String, required: true },
    name: { type: String, required: true }
  }],
  lastSynced: { type: Date, default: Date.now }
});

export default mongoose.model<IAgentFarmerMapping>('AgentFarmerMapping', AgentFarmerMappingSchema);

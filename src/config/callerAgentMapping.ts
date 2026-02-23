import agentFarmerMappingService from '../services/agentFarmerMappingService';

/**
 * Agent to Callers mapping configuration
 * Each agent has a list of their designated callers
 */

interface AgentCallers {
  agentNumber: string;
  callers: string[];
}

/**
 * Agent-to-callers mappings
 * Each agent has their own list of callers
 */
export const agentCallersMapping: AgentCallers[] = [
  // Example: Agent A with their callers
  // {
  //   agentNumber: "+2348087654321",
  //   callers: ["+2348012345678", "+2347012345678", "+2349012345678"]
  // },
  // Example: Agent B with their callers
  // {
  //   agentNumber: "+2348098765432",
  //   callers: ["+2348011111111", "+2347022222222"]
  // },
];

/**
 * Get agent number for a specific caller
 * @param callerNumber - The incoming caller's phone number
 * @returns Agent phone number if mapped, undefined otherwise
 */
export async function getAgentForCaller(callerNumber: string): Promise<string | undefined> {
  return await agentFarmerMappingService.getAgentForFarmer(callerNumber) || undefined;
}

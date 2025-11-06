import { EventEmitter } from 'events';

class AIAudioEventEmitter extends EventEmitter {
  // Emit when AI audio is ready for a session
  emitAudioReady(sessionId: string, audioTag: string): void {
    this.emit('audioReady', { sessionId, audioTag });
  }

  // Listen for audio ready events
  onAudioReady(callback: (data: { sessionId: string; audioTag: string }) => void): void {
    this.on('audioReady', callback);
  }
}

export default new AIAudioEventEmitter();
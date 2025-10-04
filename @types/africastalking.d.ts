declare module 'africastalking' {
  interface AfricasTalkingOptions {
    apiKey: string;
    username: string;
  }

  interface VoiceService {
    call(options: any): Promise<any>;
    uploadMediaFile(url: string): Promise<any>;
  }

  interface AfricasTalkingClient {
    VOICE: VoiceService;
  }

  function AfricasTalking(options: AfricasTalkingOptions): AfricasTalkingClient;
  
  export = AfricasTalking;
}
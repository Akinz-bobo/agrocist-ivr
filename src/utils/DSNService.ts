import axios from "axios";
import config from "../config";
import FormData from "form-data";
import logger from "./logger";

class DSNService {
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private authPromise: Promise<string | null> | null = null;

  async makeDSNRequest(text: string, voiceConfig: {voiceId: string, language: string}, sessionId?: string): Promise<Buffer | null> {
    try {
      const token = await this.authenticateDSN();
      if (!token) {
        logger.error('Failed to authenticate with DSN API');
        return null;
      }

      const formData = new FormData();
      formData.append("text", text);
      formData.append("language", voiceConfig.language);
      formData.append("voice", voiceConfig.voiceId);
    

      const startTime = Date.now();
      const response = await axios({
        method: "POST",
        url: `${config.dsn.baseUrl}/api/v1/ai/spitch/text-to-speech`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        responseType: "arraybuffer",
        timeout: 10000,
      });

      const requestTime = Date.now() - startTime;
      const sessionInfo = sessionId ? ` [${sessionId.slice(-8)}]` : '';
      logger.info(`DSN TTS${sessionInfo}: ${response.data.byteLength} bytes in ${requestTime}ms`);
      return Buffer.from(response.data);
    } catch (error) {
      const sessionInfo = sessionId ? ` [${sessionId.slice(-8)}]` : '';
      logger.error(`DSN TTS${sessionInfo} failed:`, error);
      return null;
    }
  }

  async preAuthenticate(): Promise<void> {
    try {
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        logger.info('DSN token already valid, no pre-authentication needed');
        return;
      }
      
      logger.info('Pre-authenticating DSN for faster TTS generation...');
      await this.authenticateDSN();
    } catch (error) {
      logger.warn('Pre-authentication failed, will retry during TTS:', error);
    }
  }

  private async authenticateDSN(): Promise<string | null> {
    try {
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.authToken;
      }

      if (this.authPromise) {
        logger.info('Authentication already in progress, waiting...');
        return this.authPromise;
      }

      this.authPromise = this.performAuthentication();
      const result = await this.authPromise;
      this.authPromise = null;
      return result;
    } catch (error: any) {
      this.authPromise = null;
      logger.warn("DSN authentication failed:", error.message || "Unknown error");
      return null;
    }
  }

  private async performAuthentication(): Promise<string | null> {
    try {
      logger.info("Authenticating with DSN API...");

      const authResponse = await axios({
        method: "POST",
        url: `${config.dsn.baseUrl}/api/v1/auth/login/json`,
        headers: { "Content-Type": "application/json" },
        data: {
          identifier: config.dsn.username,
          password: config.dsn.password,
        },
        timeout: 3000,
      });

      if (authResponse.data?.access_token) {
        this.authToken = authResponse.data.access_token;
        this.tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
        logger.info(`DSN authentication successful, token expires: ${this.tokenExpiry}`);
        return this.authToken;
      } else {
        logger.warn("DSN authentication failed: No access_token in response");
        return null;
      }
    } catch (error: any) {
      logger.warn("DSN authentication failed:", error.message || "Unknown error");
      return null;
    }
  }
}

export default new DSNService();
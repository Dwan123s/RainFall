import { dataStore } from '../db/store';
import { rainfallService } from '../services/rainfall.service';
import { measurementService } from '../services/measurement.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  calculateDewPoint,
  calculateHeatIndex,
  classifyPressureTrend,
  getStartOfDayInTimezone,
  StationContext,
  ChatTurn,
  normalizeStationContext,
  cleanChatHistory,
  cleanLatexArtifacts,
  buildRainSensePrompt,
  generateRainSenseReply,
  computeRainHistory
} from '../shared';

export type ChatMessage = ChatTurn;

export class AiService {
  /**
   * Get current live weather context for the station
   */
  async getLiveContext(deviceId: string = env.DEFAULT_STATION_ID): Promise<StationContext> {
    const device = await dataStore.getDevice(deviceId);
    const latest = await dataStore.getLatestMeasurement(deviceId);
    const rainfall = await rainfallService.getStatistics(deviceId);
    const envSummary = await measurementService.getEnvironmentalSummary(deviceId);
    const config = await dataStore.getConfig(deviceId);
    const recentAlerts = await dataStore.getAlerts({ deviceId, limit: 3 });

    const currentTemp = latest?.temperature ?? envSummary?.temperature?.current ?? null;
    const currentHumid = latest?.humidity ?? envSummary?.humidity?.current ?? null;
    const currentPress = latest?.pressure ?? envSummary?.pressure?.current ?? null;
    const dewPoint = currentTemp !== null && currentHumid !== null ? calculateDewPoint(currentTemp, currentHumid) : null;
    const heatIndex = currentTemp !== null && currentHumid !== null ? calculateHeatIndex(currentTemp, currentHumid) : null;
    const pressureTrend = currentPress !== null ? classifyPressureTrend(currentPress)?.labelVi || 'Ổn định' : 'Chưa đủ lịch sử để xác định';

    const timezone = device?.timezone || 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const startOfDay = getStartOfDayInTimezone(now, timezone);

    let rainHistory = null;
    try {
      const dayEvents = await dataStore.getRainEvents(deviceId, startOfDay.toISOString());
      const dayMeasurements = await dataStore.getMeasurements(deviceId, { from: startOfDay.toISOString() });
      rainHistory = computeRainHistory({
        events: dayEvents,
        measurements: dayMeasurements,
        timezone,
        now,
        mqttIntervalSeconds: config?.mqttInterval || 30,
        defaultCalibration: config?.rainMmPerTip || rainfall?.calibrationFactor || 0.64
      });
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to compute rain history for AI context');
    }

    return normalizeStationContext({
      deviceId: device?.deviceId || deviceId,
      stationName: device?.name || `Trạm ${deviceId}`,
      timezone,
      isOnline: device?.isOnline ?? false,
      observedAt: latest?.timestamp ? new Date(latest.timestamp).toISOString() : null,
      lastSeen: device?.lastSeen || null,
      currentTemp,
      currentHumid,
      currentPress,
      dewPoint,
      heatIndex,
      todayRainMm: rainfall?.todayMm ?? (rainHistory ? rainHistory.recordedTotalMm : null),
      rolling24hRainMm: rainfall?.rolling24hMm ?? null,
      currentRainRateMmH: rainfall?.currentRateMmH ?? null,
      totalTipsToday: rainfall?.totalTipsToday ?? null,
      calibrationFactor: config?.rainMmPerTip ?? rainfall?.calibrationFactor ?? 0.64,
      pressureTrend,
      recentAlerts: (recentAlerts || []).map((a) => a.message),
      rainHistory
    }, deviceId);
  }

  /**
   * Process a chat message with live context
   */
  async chat(
    userMessage: string,
    history: ChatTurn[] = [],
    deviceId: string = env.DEFAULT_STATION_ID
  ): Promise<{ reply: string; context: StationContext }> {
    const context = await this.getLiveContext(deviceId);
    const cleanedHistory = cleanChatHistory(history);

    // 1. If GEMINI_API_KEY is configured in environment, call Gemini
    const geminiKey = process.env.GEMINI_API_KEY || (env as any).GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const reply = await this.callGeminiApi(userMessage, cleanedHistory, context, geminiKey);
        if (reply && reply.trim().length > 0) {
          return { reply: cleanLatexArtifacts(reply), context };
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Gemini API call failed, falling back to built-in RainSense reasoning engine');
      }
    }

    // 2. Intelligent Built-in RainSense Fallback Engine
    const reply = generateRainSenseReply(userMessage, context, cleanedHistory);
    return { reply: cleanLatexArtifacts(reply), context };
  }

  /**
   * Gemini API integration with grounding
   */
  private async callGeminiApi(
    userMessage: string,
    history: ChatTurn[],
    context: StationContext,
    apiKey: string
  ): Promise<string | null> {
    const systemPrompt = buildRainSensePrompt(context);

    const validHistory = history
      .filter((msg) => msg && typeof msg.content === 'string' && msg.content.trim() !== '')
      .slice(-6)
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    const contents = [
      ...validHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ];

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1000
              }
            })
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate && candidate.trim().length > 0) {
            return candidate.trim();
          }
        } else {
          const errText = await response.text();
          logger.warn({ model, status: response.status, errText: errText.slice(0, 150) }, 'Gemini model attempt returned non-OK');
        }
      } catch (err: any) {
        logger.warn({ model, error: err.message }, 'Gemini model request failed');
      }
    }

    return null;
  }
}

export const aiService = new AiService();

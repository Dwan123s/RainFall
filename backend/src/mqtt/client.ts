import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { handleTelemetryMessage } from './handlers/telemetry.handler';
import { handleRainEventMessage } from './handlers/rain.handler';
import { handleStatusMessage } from './handlers/status.handler';
import { handleCommandAckMessage } from './handlers/ack.handler';

let client: MqttClient | null = null;
let isConnected = false;
let isConnecting = false;
let subscribedTopics: string[] = [];

/**
 * Normalizes broker URL to ensure valid MQTT protocol schema
 */
export function normalizeBrokerUrl(url: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  // Automatically fix if user accidentally pasted https:// or http:// from browser address bar
  if (trimmed.startsWith('https://')) {
    trimmed = trimmed.substring('https://'.length);
    if (!trimmed.includes(':')) {
      return `mqtts://${trimmed}:8883`;
    }
    return `mqtts://${trimmed}`;
  }
  if (trimmed.startsWith('http://')) {
    trimmed = trimmed.substring('http://'.length);
    if (!trimmed.includes(':')) {
      return `mqtt://${trimmed}:1883`;
    }
    return `mqtt://${trimmed}`;
  }

  if (
    trimmed.startsWith('mqtt://') ||
    trimmed.startsWith('mqtts://') ||
    trimmed.startsWith('tcp://') ||
    trimmed.startsWith('tls://') ||
    trimmed.startsWith('ssl://') ||
    trimmed.startsWith('ws://') ||
    trimmed.startsWith('wss://')
  ) {
    return trimmed;
  }
  // If port 8883 or 8884 is specified, default to mqtts://
  if (trimmed.includes(':8883') || trimmed.includes(':8884')) {
    return `mqtts://${trimmed}`;
  }
  // Otherwise default to mqtt://
  return `mqtt://${trimmed}`;
}

/**
 * Builds MQTT client connection options with EMQX & TLS support
 */
export function buildMqttOptions(overrides: Partial<IClientOptions> = {}): IClientOptions {
  const brokerUrl = normalizeBrokerUrl(env.MQTT_BROKER_URL);
  const isTls =
    brokerUrl.startsWith('mqtts://') ||
    brokerUrl.startsWith('tls://') ||
    brokerUrl.startsWith('ssl://') ||
    brokerUrl.includes(':8883');

  const options: IClientOptions = {
    clientId: `${env.MQTT_CLIENT_ID}-${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    connectTimeout: env.MQTT_CONNECT_TIMEOUT,
    keepalive: env.MQTT_KEEPALIVE,
    reconnectPeriod: 5000,
    ...overrides
  };

  if (env.MQTT_USERNAME && env.MQTT_USERNAME.trim().length > 0) {
    options.username = env.MQTT_USERNAME.trim();
  }
  if (env.MQTT_PASSWORD && env.MQTT_PASSWORD.trim().length > 0) {
    options.password = env.MQTT_PASSWORD.trim();
  }

  // Configure TLS / SSL for EMQX Cloud or secure self-hosted brokers
  if (isTls) {
    options.rejectUnauthorized = env.MQTT_REJECT_UNAUTHORIZED;

    // Load custom CA certificate if specified
    if (env.MQTT_CA_CERT && env.MQTT_CA_CERT.trim().length > 0) {
      try {
        const certInput = env.MQTT_CA_CERT.trim();
        if (fs.existsSync(certInput)) {
          options.ca = [fs.readFileSync(certInput)];
          logger.info({ caPath: certInput }, 'Loaded custom MQTT CA certificate from file');
        } else if (certInput.includes('-----BEGIN CERTIFICATE-----')) {
          options.ca = [Buffer.from(certInput)];
          logger.info('Loaded custom MQTT CA certificate from environment string');
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.warn({ err: error.message }, 'Failed to load custom MQTT CA certificate');
      }
    }
  }

  return options;
}

/**
 * Initializes and connects to the EMQX MQTT Broker
 */
export function initMqttClient(): MqttClient | null {
  const rawUrl = env.MQTT_BROKER_URL;
  if (!rawUrl || rawUrl.trim() === '') {
    logger.info('MQTT Client skipped: No broker URL configured.');
    return null;
  }

  const brokerUrl = normalizeBrokerUrl(rawUrl);

  try {
    isConnecting = true;
    logger.info(
      {
        broker: brokerUrl,
        clientIdPrefix: env.MQTT_CLIENT_ID,
        hasAuth: Boolean(env.MQTT_USERNAME),
        strictTls: env.MQTT_REJECT_UNAUTHORIZED
      },
      'Connecting to EMQX MQTT Broker...'
    );

    const options = buildMqttOptions();
    client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
      isConnected = true;
      isConnecting = false;
      logger.info({ broker: brokerUrl }, 'EMQX MQTT Connection established successfully.');

      const prefix = env.MQTT_TOPIC_PREFIX;
      subscribedTopics = [
        `${prefix}/+/telemetry`,
        `${prefix}/+/rain`,
        `${prefix}/+/status`,
        `${prefix}/+/command/ack`,
        `${prefix}/+/config`
      ];

      client?.subscribe(subscribedTopics, (err) => {
        if (err) {
          logger.error({ err, topics: subscribedTopics }, 'Failed to subscribe to EMQX MQTT topics');
        } else {
          logger.info({ topics: subscribedTopics }, 'Subscribed to EMQX RainSense MQTT topics');
        }
      });
    });

    client.on('reconnect', () => {
      isConnecting = true;
      isConnected = false;
      logger.warn('Reconnecting to EMQX MQTT broker...');
    });

    client.on('close', () => {
      isConnected = false;
      isConnecting = false;
      logger.warn('EMQX MQTT Connection closed.');
    });

    client.on('offline', () => {
      isConnected = false;
      isConnecting = false;
      logger.warn('EMQX MQTT Client went offline.');
    });

    client.on('error', (err: Error & { code?: string | number }) => {
      isConnected = false;
      isConnecting = false;

      // Provide diagnostic troubleshooting tips based on EMQX error code
      let hint = 'Broker error encountered. Will auto-retry reconnecting.';
      if (err.message.includes('DEPTH_ZERO_SELF_SIGNED_CERT') || err.message.includes('SELF_SIGNED_CERT_IN_CHAIN')) {
        hint = 'TLS Certificate verification failed. Set MQTT_REJECT_UNAUTHORIZED=false or supply MQTT_CA_CERT in .env';
      } else if (err.message.includes('ECONNREFUSED')) {
        hint = `Cannot reach EMQX broker at ${brokerUrl}. Verify that EMQX is running and port is open.`;
      } else if (err.message.includes('Not authorized') || err.code === 134 || err.code === 135 || err.code === 4 || err.code === 5) {
        hint = 'EMQX Authentication failed. Check MQTT_USERNAME and MQTT_PASSWORD in .env';
      }

      logger.warn({ message: err.message, code: err.code, hint }, `EMQX MQTT Error: ${err.message}`);
    });

    client.on('message', (topic, payload) => {
      try {
        const parts = topic.split('/');
        // Expecting {prefix}/{deviceId}/{subtopic}
        if (parts.length < 3) return;

        const subtopic = parts.slice(2).join('/');

        if (subtopic === 'telemetry') {
          handleTelemetryMessage(topic, payload);
        } else if (subtopic === 'rain') {
          handleRainEventMessage(topic, payload);
        } else if (subtopic === 'status') {
          handleStatusMessage(topic, payload);
        } else if (subtopic === 'command/ack') {
          handleCommandAckMessage(topic, payload);
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.error({ err: error.message, topic }, 'Error dispatching EMQX MQTT message');
      }
    });

    return client;
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Failed to initialize EMQX MQTT client');
    return null;
  }
}

/**
 * Returns current MQTT connection status string
 */
export function getMqttStatus(): 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' {
  if (isConnected) return 'CONNECTED';
  if (isConnecting) return 'RECONNECTING';
  return 'DISCONNECTED';
}

/**
 * Returns detailed metadata about the EMQX MQTT connection
 */
export function getMqttInfo() {
  const rawUrl = env.MQTT_BROKER_URL || '';
  const brokerUrl = normalizeBrokerUrl(rawUrl);

  // Mask user credentials if present in URL
  let maskedBroker = brokerUrl;
  try {
    const parsed = new URL(brokerUrl.replace('mqtt://', 'http://').replace('mqtts://', 'https://'));
    maskedBroker = `${parsed.protocol.replace('http', 'mqtt')}//${parsed.host}${parsed.pathname}`;
  } catch {
    // Keep as is if URL parsing is non-standard
  }

  return {
    status: getMqttStatus(),
    connected: isConnected,
    broker: maskedBroker,
    clientId: env.MQTT_CLIENT_ID,
    topicPrefix: env.MQTT_TOPIC_PREFIX,
    subscribedTopics,
    hasAuth: Boolean(env.MQTT_USERNAME),
    tlsStrict: env.MQTT_REJECT_UNAUTHORIZED
  };
}

/**
 * Publishes a downlink command to an ESP32-S3 station via EMQX MQTT
 */
export async function publishMqttCommand(
  deviceId: string,
  commandPayload: Record<string, unknown>
): Promise<boolean> {
  const prefix = env.MQTT_TOPIC_PREFIX;
  const topic = `${prefix}/${deviceId}/command`;

  if (!client || !isConnected) {
    logger.warn({ topic, commandPayload }, 'EMQX MQTT Client not connected; command saved in store only');
    return false;
  }

  return new Promise((resolve) => {
    client?.publish(topic, JSON.stringify(commandPayload), { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err, topic }, 'Failed to publish command to EMQX MQTT');
        resolve(false);
      } else {
        logger.info({ topic, commandPayload }, 'Published command to station via EMQX MQTT');
        resolve(true);
      }
    });
  });
}

/**
 * Standalone connection test utility for EMQX Broker
 */
export async function testMqttConnection(
  targetUrl?: string,
  username?: string,
  password?: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const url = normalizeBrokerUrl(targetUrl || env.MQTT_BROKER_URL);
  const start = Date.now();

  return new Promise((resolve) => {
    const isTls =
      url.startsWith('mqtts://') ||
      url.startsWith('tls://') ||
      url.startsWith('ssl://') ||
      url.includes(':8883');

    const testOpts: IClientOptions = {
      clientId: `test-probe-${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 7000,
      username: username ?? (env.MQTT_USERNAME || undefined),
      password: password ?? (env.MQTT_PASSWORD || undefined)
    };

    if (isTls) {
      testOpts.rejectUnauthorized = env.MQTT_REJECT_UNAUTHORIZED;
    }

    const testClient = mqtt.connect(url, testOpts);
    let resolved = false;

    const cleanup = () => {
      try {
        testClient.removeAllListeners();
        testClient.end(true);
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({
          success: false,
          message: `Connection to EMQX timed out after 7000ms at ${url}`,
          latencyMs: Date.now() - start
        });
      }
    }, 7500);

    testClient.on('connect', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        cleanup();
        resolve({
          success: true,
          message: `Connected successfully to EMQX Broker (${url}) in ${latency}ms`,
          latencyMs: latency
        });
      }
    });

    testClient.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          success: false,
          message: `EMQX connection error: ${err.message}`,
          latencyMs: Date.now() - start
        });
      }
    });
  });
}

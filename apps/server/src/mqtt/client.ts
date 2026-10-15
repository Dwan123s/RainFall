import mqtt, { MqttClient } from 'mqtt';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { handleTelemetryMessage } from './handlers/telemetry.handler';
import { handleRainEventMessage } from './handlers/rain.handler';
import { handleStatusMessage } from './handlers/status.handler';
import { handleCommandAckMessage } from './handlers/ack.handler';

let client: MqttClient | null = null;
let isConnected = false;
let isConnecting = false;

export function initMqttClient(): MqttClient | null {
  // If in demo mode and mock broker URL is set, we don't block on real MQTT
  if (!env.MQTT_BROKER_URL || env.MQTT_BROKER_URL.includes('mock-broker')) {
    logger.info('MQTT Client running with local/demo mode (external broker mock-configured).');
    return null;
  }

  try {
    isConnecting = true;
    logger.info({ broker: env.MQTT_BROKER_URL }, 'Connecting to MQTT Broker (HiveMQ Cloud / TLS)...');

    client = mqtt.connect(env.MQTT_BROKER_URL, {
      clientId: `${env.MQTT_CLIENT_ID}-${Math.random().toString(16).substring(2, 8)}`,
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 5000,
      rejectUnauthorized: true // Strict TLS verification
    });

    client.on('connect', () => {
      isConnected = true;
      isConnecting = false;
      logger.info('MQTT Connection established successfully.');

      const prefix = env.MQTT_TOPIC_PREFIX;
      const topics = [
        `${prefix}/+/telemetry`,
        `${prefix}/+/rain`,
        `${prefix}/+/status`,
        `${prefix}/+/command/ack`,
        `${prefix}/+/config`
      ];

      client?.subscribe(topics, (err) => {
        if (err) {
          logger.error({ err }, 'Failed to subscribe to MQTT topics');
        } else {
          logger.info({ topics }, 'Subscribed to RainSense MQTT topics');
        }
      });
    });

    client.on('reconnect', () => {
      isConnecting = true;
      logger.warn('Reconnecting to MQTT broker...');
    });

    client.on('close', () => {
      isConnected = false;
      isConnecting = false;
      logger.warn('MQTT Connection closed.');
    });

    client.on('offline', () => {
      isConnected = false;
      logger.warn('MQTT Client went offline.');
    });

    client.on('error', (err) => {
      isConnected = false;
      isConnecting = false;
      logger.warn({ message: err.message }, 'MQTT Broker error (non-fatal; will auto-retry)');
    });

    client.on('message', (topic, payload) => {
      const parts = topic.split('/');
      // Expecting weather/{deviceId}/{subtopic}
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
    });

    return client;
  } catch (err: unknown) {
    const error = err as Error;
    logger.error({ err: error.message }, 'Failed to initialize MQTT client');
    return null;
  }
}

export function getMqttStatus(): 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' {
  if (isConnected) return 'CONNECTED';
  if (isConnecting) return 'RECONNECTING';
  return 'DISCONNECTED';
}

export async function publishMqttCommand(
  deviceId: string,
  commandPayload: Record<string, unknown>
): Promise<boolean> {
  const prefix = env.MQTT_TOPIC_PREFIX;
  const topic = `${prefix}/${deviceId}/command`;

  if (!client || !isConnected) {
    logger.warn({ topic, commandPayload }, 'MQTT Client not connected; command queued in store only');
    return false;
  }

  return new Promise((resolve) => {
    client?.publish(topic, JSON.stringify(commandPayload), { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err, topic }, 'Failed to publish command to MQTT');
        resolve(false);
      } else {
        logger.info({ topic, commandPayload }, 'Published command to station via MQTT');
        resolve(true);
      }
    });
  });
}

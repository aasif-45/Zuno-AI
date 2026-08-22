import redis from "../../../shared/redis/redis.js";
import { getMessages } from "../utils/getMessages.js";

export const getMemory = async (conversationId) => {
  const key = `message-${conversationId}`;
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  const messages = await getMessages(conversationId);
  await redis.set(key, JSON.stringify(messages), "EX", 24 * 60 * 60);
  return messages;
};

export const addMessage = async (conversationId, role, content, images = [], artifacts = []) => {
  const key = `message-${conversationId}`;
  const rawMessage = await redis.get(key);
  const messages = rawMessage ? JSON.parse(rawMessage) : [];
  messages.push({
    role,
    content,
    images: Array.isArray(images) ? images : [],
    artifacts: Array.isArray(artifacts) ? artifacts : [],
  });
  // Keep only the last 50 messages
  if (messages.length > 50) {
    messages.shift();
  }
  await redis.set(key, JSON.stringify(messages), "EX", 24 * 60 * 60);
};
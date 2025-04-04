export interface ModelConfig {
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  repetitionPenalty?: number;
  logLevel?: string; // Added log level for logging configuration
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelStatus {
  isLoading: boolean;
  progress?: number;
  error?: string;
}

export const defaultModelConfig: ModelConfig = {
  modelId: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
  temperature: 0.7,
  maxTokens: 800,
  topP: 0.9,
  repetitionPenalty: 1.1,
  logLevel: '3', // INFO level by default
};
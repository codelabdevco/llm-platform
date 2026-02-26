import { Injectable, BadRequestException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'ollama';
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

// Cost per 1M tokens in USD cents
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-20250514':    { input: 1500, output: 7500 },
  'claude-sonnet-4-20250514':  { input: 300,  output: 1500 },
  'claude-haiku-4-5-20251001': { input: 80,   output: 400  },
  // OpenAI
  'gpt-4o':                    { input: 250,  output: 1000 },
  'gpt-4o-mini':               { input: 15,   output: 60   },
  'gpt-4-turbo':               { input: 1000, output: 3000 },
  // Google
  'gemini-1.5-pro':            { input: 125,  output: 375  },
  'gemini-1.5-flash':          { input: 7,    output: 21   },
  'gemini-2.0-flash':          { input: 10,   output: 40   },
  // Ollama (free/local)
  'default-ollama':            { input: 0,    output: 0    },
};

export const AVAILABLE_MODELS = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4',      vision: true  },
  { provider: 'anthropic', model: 'claude-opus-4-20250514',    label: 'Claude Opus 4',        vision: true  },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',     vision: true  },
  // OpenAI
  { provider: 'openai',    model: 'gpt-4o',                   label: 'GPT-4o',               vision: true  },
  { provider: 'openai',    model: 'gpt-4o-mini',              label: 'GPT-4o Mini',          vision: true  },
  { provider: 'openai',    model: 'gpt-4-turbo',              label: 'GPT-4 Turbo',          vision: true  },
  // Google
  { provider: 'google',    model: 'gemini-2.0-flash',         label: 'Gemini 2.0 Flash',     vision: true  },
  { provider: 'google',    model: 'gemini-1.5-pro',           label: 'Gemini 1.5 Pro',       vision: true  },
  { provider: 'google',    model: 'gemini-1.5-flash',         label: 'Gemini 1.5 Flash',     vision: true  },
  // Ollama
  { provider: 'ollama',    model: 'llama3.2',                 label: 'Llama 3.2 (Local)',    vision: false },
  { provider: 'ollama',    model: 'mistral',                  label: 'Mistral (Local)',       vision: false },
  { provider: 'ollama',    model: 'qwen2.5',                  label: 'Qwen 2.5 (Local)',     vision: false },
];

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PRICING['default-ollama'];
  return Math.round(
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

@Injectable()
export class ModelsService {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private google: GoogleGenerativeAI;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY)
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    if (process.env.OPENAI_API_KEY)
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      this.google = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  }

  getModels() {
    return AVAILABLE_MODELS.filter(m => {
      if (m.provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
      if (m.provider === 'openai')    return !!process.env.OPENAI_API_KEY;
      if (m.provider === 'google')    return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (m.provider === 'ollama')    return !!process.env.OLLAMA_BASE_URL;
      return false;
    });
  }

  async *streamChat(
    config: ModelConfig,
    messages: ChatMessage[],
  ): AsyncGenerator<StreamChunk> {
    switch (config.provider) {
      case 'anthropic': yield* this.streamAnthropic(config, messages); break;
      case 'openai':    yield* this.streamOpenAI(config, messages);    break;
      case 'google':    yield* this.streamGoogle(config, messages);    break;
      case 'ollama':    yield* this.streamOllama(config, messages);    break;
      default: throw new BadRequestException(`Unknown provider: ${config.provider}`);
    }
  }

  private async *streamAnthropic(config: ModelConfig, messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    const userMessages = messages.filter(m => m.role !== 'system');
    const stream = this.anthropic.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      system: config.systemPrompt || '',
      messages: userMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { text: event.delta.text, done: false };
      }
      if (event.type === 'message_delta') {
        outputTokens = event.usage?.output_tokens || 0;
      }
      if (event.type === 'message_start') {
        inputTokens = event.message?.usage?.input_tokens || 0;
      }
    }
    yield { text: '', done: true, inputTokens, outputTokens };
  }

  private async *streamOpenAI(config: ModelConfig, messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    const allMessages = config.systemPrompt
      ? [{ role: 'system' as const, content: config.systemPrompt }, ...messages.map(m => ({ role: m.role as any, content: m.content }))]
      : messages.map(m => ({ role: m.role as any, content: m.content }));

    const stream = await this.openai.chat.completions.create({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      stream: true,
      stream_options: { include_usage: true },
      messages: allMessages,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { text: delta, done: false };
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }
    yield { text: '', done: true, inputTokens, outputTokens };
  }

  private async *streamGoogle(config: ModelConfig, messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    const genModel = this.google.getGenerativeModel({
      model: config.model,
      systemInstruction: config.systemPrompt,
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = messages[messages.length - 1];
    const chat = genModel.startChat({ history });
    const result = await chat.sendMessageStream(lastMsg.content);

    let outputTokens = 0;
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield { text, done: false };
    }
    const usage = await result.response;
    outputTokens = usage.usageMetadata?.candidatesTokenCount || 0;
    const inputTokens = usage.usageMetadata?.promptTokenCount || 0;
    yield { text: '', done: true, inputTokens, outputTokens };
  }

  private async *streamOllama(config: ModelConfig, messages: ChatMessage[]): AsyncGenerator<StreamChunk> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line);
        if (data.message?.content) yield { text: data.message.content, done: false };
        if (data.done && data.prompt_eval_count) {
          inputTokens = data.prompt_eval_count;
          outputTokens = data.eval_count;
        }
      }
    }
    yield { text: '', done: true, inputTokens, outputTokens };
  }
}

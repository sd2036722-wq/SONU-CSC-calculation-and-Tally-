import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel, GenerateContentResponse } from '@google/genai';

export interface AiChatMessageInput {
  role: 'user' | 'model';
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AiStreamRequest {
  messages: AiChatMessageInput[];
  mode?: 'fast' | 'deep';
  language?: 'en' | 'bn' | 'bi';
  shopContext?: string;
}

const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(language?: 'en' | 'bn' | 'bi', shopContext?: string): string {
  const langNote =
    language === 'bn'
      ? 'Respond primarily in clear Bengali (বাংলা) unless the user asks in English or Hindi. Always use readable numbers.'
      : language === 'bi'
      ? 'Match the language of the user question (English, Bengali, or Hindi).'
      : 'Match the language of the user question (English, Bengali, or Hindi); default to clear English.';

  let instruction = `You are a super-fast, highly accurate AI Calculation Solver & General Q&A Assistant.
Your core strengths:
1. Instant & Exact Calculation Solving:
   - Solve ANY calculation accurately: arithmetic, percentages, discounts, GST/tax, profit & loss, simple & compound interest, EMI, currency/unit conversions (sq ft, bigha, katha, kg, liter), algebra, geometry, percentages, ratios, bill totals, and change calculation.
   - Double-check all arithmetic carefully before writing the final number.
   - Put the **Final Answer** clearly near the top or bottom in bold (e.g. **Answer: ₹1,250**), followed by short, crystal-clear step-by-step working so it is easy to verify at a glance.
2. Fast General Q&A:
   - Answer any question (shop services, Indian government forms/documents, general knowledge, coding, science, writing, translations, daily business queries) accurately, concisely, and without fluff.
3. Formatting & Language:
   - ${langNote}
   - Keep responses clean, well-structured with bullet points or numbered steps when helpful, and fast to read.`;

  if (shopContext && shopContext.trim()) {
    instruction += `\n\nLive Shop Context (use only when the user asks about their shop figures):\n${shopContext.trim()}`;
  }

  return instruction;
}

function toGeminiContents(messages: AiChatMessageInput[]) {
  return messages
    .filter(m => (m.text && m.text.trim().length > 0) || m.imageBase64)
    .map(m => {
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (m.imageBase64 && m.imageMimeType) {
        parts.push({
          inlineData: {
            mimeType: m.imageMimeType,
            data: m.imageBase64,
          },
        });
      }

      if (m.text && m.text.trim().length > 0) {
        parts.push({ text: m.text.trim() });
      } else if (parts.length > 0) {
        parts.push({ text: 'Solve or explain what is shown in this image step by step.' });
      }

      return {
        role: m.role === 'model' ? 'model' : 'user',
        parts,
      };
    });
}

export function formatGeminiError(err: any): { status: number; message: string } {
  const rawMessage = err?.message || String(err || 'Unknown AI error');
  const statusCode = Number(err?.status || err?.code || 500);

  if (
    rawMessage.includes('GEMINI_API_KEY is not configured') ||
    rawMessage.includes('API_KEY_INVALID') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    statusCode === 403
  ) {
    return {
      status: statusCode === 403 ? 403 : 400,
      message:
        'AI API key is missing or invalid. Please check your GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || statusCode === 429) {
    return {
      status: 429,
      message:
        'AI rate limit or quota exceeded. Please wait a moment and try again, or check your billing quota in Settings > Secrets.',
    };
  }

  if (rawMessage.includes('NOT_FOUND') || statusCode === 404) {
    return {
      status: 404,
      message: 'Selected AI model endpoint was not found. Please try again.',
    };
  }

  return {
    status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    message: rawMessage,
  };
}

export async function streamAiResponse(
  params: AiStreamRequest,
  onChunk: (text: string) => void
): Promise<void> {
  const ai = getAiClient();
  const contents = toGeminiContents(params.messages || []);

  if (contents.length === 0) {
    throw new Error('Please enter a calculation or question.');
  }

  const thinkingLevel = params.mode === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.LOW;
  const systemInstruction = buildSystemInstruction(params.language, params.shopContext);

  const maxAttempts = 2;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel },
        },
      });

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          onChunk(c.text);
        }
      }
      return;
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      const isRetryable =
        attempt < maxAttempts &&
        (msg.includes('503') || msg.includes('500') || msg.includes('ECONNRESET') || msg.includes('fetch failed'));

      if (isRetryable) {
        await new Promise(resolve => setTimeout(resolve, 400 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

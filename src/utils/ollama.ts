import { createParser } from 'eventsource-parser';
import type { ParsedEvent, ReconnectInterval } from 'eventsource-parser';
import type { ChatMessage } from '@/types';

export const model = "llama3";

export const generateOllamaPayload = (
    messages: ChatMessage[],
    temperature: number,
): RequestInit & { dispatcher?: any } => {
    return {
        headers: {
            'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
            model,
            messages,
            options: {
                temperature,
            },
            stream: true
        })
    };
}

/// Ollama's returned chunk is in complete JSON so we dont need to use `eventsource-parser`
/// to parse the chunk - which expects each event to be separated by a newline and typically prefixed
/// by `data: `.
/// Example (`decodedChunk`):
///  1. {"model":"llama3","created_at":"2024-07-23T04:28:32.186936219Z","message":{"role":"assistant","content":"?"},"done":false}
///  2. {
///      "model":"llama3","created_at":"2024-07-23T04:28:32.511855878Z","message":{"role":"assistant","content":""},"done_reason":"stop",
///      "done":true,"total_duration":56635660574,"load_duration":30430400143,"prompt_eval_count":22,"prompt_eval_duration":4025286000,"eval_count":68,
///      "eval_duration":22173563000
///     }
export const parseOllamaStream = (rawResponse: Response) => {
    if (!rawResponse.ok) {
        return new Response(rawResponse.body, {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
        });
    }
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of rawResponse.body as any) {
                const decodedChunk = decoder.decode(chunk, {stream: true});
                console.log("Chunk received:", decodedChunk)
                try {
                    const json = JSON.parse(decodedChunk);
                    console.log("json:", json);
                    const text = json.message?.content || '';
                    console.log("text:", text);
                    const queue = encoder.encode(text);
                    controller.enqueue(queue);
                    if (json.done) {
                        console.log("closing ollama")
                        controller.close();
                        return;
                    }
                } catch (e) {
                    controller.error(e);
                }
            }
        }
    });

    return new Response(stream);
}
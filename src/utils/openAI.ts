import { createParser } from 'eventsource-parser'
import type { ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import type { ChatMessage } from '@/types'

export const model = import.meta.env.OPENAI_API_MODEL || 'gpt-4o'

export const generatePayload = (
  apiKey: string,
  messages: ChatMessage[],
  temperature: number,
): RequestInit & { dispatcher?: any } => {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    method: 'POST',
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
  };
}

/// OpenAI's returned chunk is not in complete JSON so we need to use `eventsource-parser`
/// to parse the chunk
/// Example (`event`):
/// {
///   type: 'event',
///   id: undefined,
///   event: undefined,
///   data: '{"id":"chatcmpl-9o1QXS0cSpxLegVR9gKnd24dl6qgQ","object":"chat.completion.chunk","created":1721708913,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_400f27fa1f","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}'
/// }
export const parseOpenAIStream = (rawResponse: Response) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  if (!rawResponse.ok) {
    return new Response(rawResponse.body, {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const streamParser = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data
          if (data === '[DONE]') {
            controller.close()
            return
          }
          try {
            // response = {
            //   id: 'chatcmpl-6pULPSegWhFgi0XQ1DtgA3zTa1WR6',
            //   object: 'chat.completion.chunk',
            //   created: 1677729391,
            //   model: 'gpt-3.5-turbo-0301',
            //   choices: [
            //     { delta: { content: '你' }, index: 0, finish_reason: null }
            //   ],
            // }
            const json = JSON.parse(data)
            const text = json.choices[0].delta?.content || ''
            const queue = encoder.encode(text)
            controller.enqueue(queue)
          } catch (e) {
            controller.error(e)
          }
        }
      }

      const parser = createParser(streamParser)
      for await (const chunk of rawResponse.body as any) {
        const decodedChunk = decoder.decode(chunk);
        parser.feed(decodedChunk);
      }
    },
  })

  return new Response(stream)
}

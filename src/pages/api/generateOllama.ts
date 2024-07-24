// #vercel-disable-blocks
import { ProxyAgent, fetch } from 'undici'
// #vercel-end
import { generateOllamaPayload, parseOllamaStream } from '@/utils/ollama';
import { verifySignature } from '@/utils/auth';
import type { APIRoute } from 'astro';

const httpsProxy = import.meta.env.HTTPS_PROXY;
const baseUrl = "http://47.90.209.195:11434";
const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

export const post: APIRoute = async (context) => {
    const body = await context.request.json();
    const { sign, time, messages, pass, temperature } = body;
    
    if (!messages) {
        return new Response(JSON.stringify({
            error: {
                message: 'No input text.',
            },
        }), { status: 400 });
    }
    if (sitePassword && !(sitePassword === pass || passList.includes(pass))) {
        return new Response(JSON.stringify({
            error: {
                message: 'Invalid password.',
            },
        }), { status: 401 });
    }
    if (
        import.meta.env.PROD && 
        !await verifySignature({
            t: time,
            m: messages?.[messages.length - 1]?.content || ''
        }, sign)
    ) {
        return new Response(JSON.stringify({
            error: {
                messgae: "Invalid signature.",
            },
        }), { status: 401 });
    }

    const initOptions = generateOllamaPayload(messages, temperature);
    // #vercel-disable-blocks
    if (httpsProxy) {
        initOptions.dispatcher = new ProxyAgent(httpsProxy);
    }
    // #vercel-end

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const response = await fetch(`${baseUrl}/api/chat`, initOptions).catch((err: Error) => {
        console.error(err);
        return new Response(JSON.stringify({
            error: {
                code: err.name,
                message: err.message,
            },
        }), { status: 500 });
    }) as Response;

    return parseOllamaStream(response) as Response;
}
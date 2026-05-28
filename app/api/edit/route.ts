import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { incrementUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hard backstop on uploaded image size. The client already resizes, but a
// hand-crafted request could skip that. base64 inflates bytes ~33%, so 8MB
// of base64 ≈ 6MB of raw image — plenty for a 1536px JPEG.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, prompt } = await req.json();

    if (!imageBase64 || !prompt) {
      return NextResponse.json(
        { error: 'Missing image or prompt' },
        { status: 400 }
      );
    }

    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Please use a smaller photo.' },
        { status: 413 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server is not configured (missing GEMINI_API_KEY)' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
    });

    // Walk the response parts to find the generated image
    const candidates = response.candidates ?? [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          // Only count successful generations
          const usage = await incrementUsage();
          return NextResponse.json({
            image: part.inlineData.data,
            usage,
          });
        }
      }
    }

    // No image returned — surface any text the model gave back
    const textResponse = candidates[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join(' ');

    return NextResponse.json(
      {
        error:
          textResponse ||
          'Model did not return an image. Try a different prompt.',
      },
      { status: 502 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Gemini error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

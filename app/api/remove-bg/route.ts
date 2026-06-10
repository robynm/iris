import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Hard backstop on uploaded image size. The client already resizes, but a
// hand-crafted request could skip that. base64 inflates bytes ~33%, so 8MB
// of base64 ≈ 6MB of raw image — plenty for a 1536px JPEG.
const MAX_BASE64_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Please use a smaller photo.' },
        { status: 413 }
      );
    }

    // Strip a possible data-URL prefix, then decode to a Buffer for the model.
    const raw = imageBase64.includes(',')
      ? imageBase64.slice(imageBase64.indexOf(',') + 1)
      : imageBase64;
    const buffer = Buffer.from(raw, 'base64');

    // The library mis-decodes a raw Buffer (it wraps it in a type-less Blob and
    // then rejects the empty MIME). Hand it a typed Blob instead;
    // 'application/octet-stream' makes it sniff the real format via sharp.
    const inputBlob = new Blob([buffer], { type: 'application/octet-stream' });

    const { removeBackground } = await import('@imgly/background-removal-node');
    const blob = await removeBackground(inputBlob, {
      // 'small' is the fastest model; quality is plenty for transparent cutouts.
      model: 'small',
      output: { format: 'image/png' },
    });

    const outBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64');

    return NextResponse.json({ image: outBase64 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Background removal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

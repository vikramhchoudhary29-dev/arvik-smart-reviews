import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/http';
import sharp from 'sharp';
import { limited } from '@/lib/http';
export const POST = route(async (r) => {
  if (await limited(r, 'upload', 10))
    return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });
  if (Number(r.headers.get('content-length') || 0) > 1100000)
    return NextResponse.json({ error: 'Maximum image size is 1 MB' }, { status: 413 });
  const form = await r.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 1000000)
    return NextResponse.json(
      { error: 'Choose a PNG, JPEG or WebP image up to 1 MB' },
      { status: 400 },
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? 'image/jpeg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp'
        : null;
  if (!mime || mime !== file.type)
    return NextResponse.json({ error: 'Invalid image content' }, { status: 400 });
  let normalized: Buffer;
  try {
    normalized = await sharp(bytes, { limitInputPixels: 20000000 })
      .rotate()
      .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'This image could not be decoded safely' }, { status: 400 });
  }
  const asset = await prisma.mediaAsset.create({
    data: { mime: 'image/webp', bytes: new Uint8Array(normalized) },
  });
  return NextResponse.json({ url: '/api/media/' + asset.id }, { status: 201 });
}, true);

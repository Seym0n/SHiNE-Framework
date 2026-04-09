import { generateCaptcha } from '@/lib/captcha';
import { NextResponse } from 'next/server';

export async function POST() {
  const { svg, hash } = generateCaptcha();
  return NextResponse.json({ captcha: svg, hash });
}

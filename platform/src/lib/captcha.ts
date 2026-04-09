import crypto from 'crypto';
import svgCaptcha from 'svg-captcha';

const SECRET = process.env.CAPTCHA_SECRET || 'vshine-captcha-secret-change-me';

export function generateCaptcha(options: svgCaptcha.ConfigObject = {}) {
  const captcha = svgCaptcha.create({
    size: 6,
    noise: 2,
    ignoreChars: '0o1ilIL',
    background: '#ffffff',
    ...options,
  });
  const hash = crypto.createHash('sha256').update(captcha.text.toLowerCase() + SECRET).digest('hex');
  return { svg: captcha.data, hash };
}

export function verifyCaptcha(text: string, hash: string): boolean {
  const expected = crypto.createHash('sha256').update(text.toLowerCase() + SECRET).digest('hex');
  return expected === hash;
}

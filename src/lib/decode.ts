export interface DecodedText {
  readonly text: string;
  readonly encoding: 'utf-8' | 'windows-1252';
}

export function decodeBytes(buffer: ArrayBuffer): DecodedText {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

  if (!utf8.includes('\uFFFD')) {
    return { text: utf8, encoding: 'utf-8' };
  }

  const latin = new TextDecoder('windows-1252', { fatal: false }).decode(bytes);
  return { text: latin, encoding: 'windows-1252' };
}

import { validateDatevFile } from '../lib/validateDatev';

self.onmessage = async (event: MessageEvent<File>) => {
  const file = event.data;
  const result = await validateDatevFile(file);
  self.postMessage(result);
};

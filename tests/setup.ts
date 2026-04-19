import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../.env') });

// Polyfills for pdf-parse in Node environment
if (typeof global.DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {};
}
if (typeof global.Path2D === 'undefined') {
  (global as any).Path2D = class Path2D {};
}

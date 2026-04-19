import fs from 'fs';
import path from 'path';

const LOG_FILE = 'C:\\Users\\vjbel\\hacks\\quorum-debate\\debug.log';

export const logger = {
  log: (...args: any[]) => {
    const msg = `[${new Date().toISOString()}] LOG: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    console.log(...args);
    if (process.env.DEBUG === 'true') {
      try {
        fs.appendFileSync(LOG_FILE, msg);
      } catch (e) {
        // Fallback to console if file write fails
      }
    }
  },
  error: (...args: any[]) => {
    const msg = `[${new Date().toISOString()}] ERROR: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    console.error(...args);
    if (process.env.DEBUG === 'true') {
      try {
        fs.appendFileSync(LOG_FILE, msg);
      } catch (e) {
      }
    }
  },
  debug: (...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      const msg = `[${new Date().toISOString()}] DEBUG: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
      try {
        fs.appendFileSync(LOG_FILE, msg);
      } catch (e) {
      }
    }
  }
};

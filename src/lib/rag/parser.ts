import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';
import os from 'os';

/**
 * The 'Nuclear Option' for PDF parsing on Windows/Next.js.
 * We launch a separate Node.js process using a temporary CommonJS script.
 * This completely bypasses ESM/CJS interop issues and Next.js bundling conflicts.
 */
export async function parseDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  logger.debug(`Attempting to parse document: ${filePath} (extension: ${ext})`);

  try {
    if (ext === '.pdf') {
      const scriptPath = path.join(os.tmpdir(), `parse_${Date.now()}.cjs`);
      const escapedFilePath = filePath.replace(/\\/g, '/');
      const pdfParsePath = path.join(process.cwd(), 'node_modules', 'pdf-parse').replace(/\\/g, '/');
      
      const scriptContent = `
const fs = require('fs');
const { PDFParse } = require('${pdfParsePath}');
const dataBuffer = fs.readFileSync("${escapedFilePath}");
const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(result => {
  process.stdout.write(result.text);
}).catch(err => {
  process.stderr.write(err.message);
  process.exit(1);
});
`;

      fs.writeFileSync(scriptPath, scriptContent);
      
      try {
        const text = execSync(`node "${scriptPath}"`, { encoding: 'utf8', timeout: 30000 });
        logger.debug(`Successfully parsed PDF via sub-process. Extracted ${text.length} characters.`);
        return text;
      } finally {
        if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      }
    } else if (ext === '.docx' || ext === '.pptx') {
      const officeParser = await import('officeparser');
      const parse = officeParser.parseOffice || (officeParser as any).default?.parseOffice;
      
      return new Promise((resolve, reject) => {
        parse(filePath, function(data: any, err: any) {
          if (err) return reject(err);
          resolve(typeof data === 'string' ? data : String(data || ''));
        });
      });
    } else {
      return "Unsupported file type: " + ext;
    }
  } catch (error: any) {
    logger.error(`Failed to parse ${filePath}:`, error.message);
    throw error;
  }
}

import fs from 'fs';
import path from 'path';
import https from 'https';

const assetsDir = path.join(process.cwd(), 'test-assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// 1. Transparent 1x1 PNG base64
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
fs.writeFileSync(path.join(assetsDir, 'nova_surge_can.png'), Buffer.from(pngBase64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'Whiteboard_Sketch.png'), Buffer.from(pngBase64, 'base64'));

// 2. Real PDF generation using pdfkit
import PDFDocument from 'pdfkit';

function createPDF(filename, text) {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(path.join(assetsDir, filename));
    doc.pipe(stream);
    doc.fontSize(25).text(text, 100, 100);
    doc.end();
    stream.on('finish', resolve);
  });
}

await createPDF('FDA_Beverage_Guidelines.pdf', 'FDA mandates 0g of sugar.');
await createPDF('OWASP_Top_10_Standards.pdf', 'OWASP rules and vulnerabilities.');
await createPDF('Tech_Architecture.pdf', 'Architecture overview and specs.');


// 3. Download minimal docx and pptx from public samples
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

(async () => {
  try {
    // Download sample docx
    await downloadFile('https://calibre-ebook.com/downloads/demos/demo.docx', path.join(assetsDir, 'Requirements.docx'));
    
    // Create an empty dummy file for PPTX if no reliable download link is available.
    // Officeparser uses `unzipper` which requires valid zip. A simple docx (which is a zip) can sometimes double as a pptx for parser if it just extracts text. Let's just copy the docx to pptx for now so officeparser won't crash on unzipping.
    fs.copyFileSync(path.join(assetsDir, 'Requirements.docx'), path.join(assetsDir, 'Pitch_Deck.pptx'));

    console.log("Assets generated successfully.");
  } catch (error) {
    console.error("Error generating assets:", error);
  }
})();

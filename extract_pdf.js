const fs = require('fs');

async function extractText(filePath, startPage, endPage) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  
  for (let i = startPage; i <= endPage; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    console.log(`--- PAGE ${i} ---`);
    console.log(strings.join(' '));
    console.log('');
  }
}

const startPage = parseInt(process.argv[3]) || 1;
const endPage = parseInt(process.argv[4]) || 24;
extractText(process.argv[2], startPage, endPage).catch(e => console.error(e));

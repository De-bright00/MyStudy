/**
 * Helper to extract text content from various file types on the client side.
 * Supported formats: .txt, .md, .pdf, .docx, .pptx, .doc
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  switch (extension) {
    case '.txt':
    case '.md':
    case '.json':
      return readAsTextAsync(file);
    case '.pdf':
      return parsePDF(file);
    case '.docx':
      return parseDocx(file);
    case '.pptx':
      return parsePptx(file);
    case '.doc':
      return parseDoc(file);
    default:
      throw new Error(`Unsupported file type: ${extension}. Please upload a .txt, .md, .pdf, .docx, .pptx, or .doc file.`);
  }
}

/**
 * Standard text reader
 */
function readAsTextAsync(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string || '');
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

/**
 * Helper to get ArrayBuffer from file
 */
function readAsArrayBufferAsync(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * PDF parser using PDF.js
 */
async function parsePDF(file: File): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF reader library (PDF.js) is not loaded yet. Please wait or reload.');
  }

  // Set the worker source path
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await readAsArrayBufferAsync(file);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  
  try {
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message || error}`);
  }
}

/**
 * DOCX parser using Mammoth
 */
async function parseDocx(file: File): Promise<string> {
  const mammoth = (window as any).mammoth;
  if (!mammoth) {
    throw new Error('Word reader library (Mammoth) is not loaded yet. Please wait or reload.');
  }

  const arrayBuffer = await readAsArrayBufferAsync(file);
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error: any) {
    console.error('Error parsing DOCX:', error);
    throw new Error(`Failed to parse Word document (.docx): ${error.message || error}`);
  }
}

/**
 * PPTX parser using JSZip
 */
async function parsePptx(file: File): Promise<string> {
  const JSZip = (window as any).JSZip;
  if (!JSZip) {
    throw new Error('Presentation reader library (JSZip) is not loaded yet. Please wait or reload.');
  }

  const arrayBuffer = await readAsArrayBufferAsync(file);
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const aNamespace = "http://schemas.openxmlformats.org/drawingml/2006/main";
    let fullText = '';
    let slideIndex = 1;

    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
      if (!slideFile) break; // End of slides

      const slideXmlStr = await slideFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXmlStr, 'application/xml');
      
      const textNodes = xmlDoc.getElementsByTagNameNS(aNamespace, 't');
      let slideText = '';
      for (let i = 0; i < textNodes.length; i++) {
        slideText += textNodes[i].textContent + ' ';
      }
      
      if (slideText.trim()) {
        fullText += `[Slide ${slideIndex}]\n${slideText.trim()}\n\n`;
      }
      
      slideIndex++;
    }
    
    return fullText.trim();
  } catch (error: any) {
    console.error('Error parsing PPTX:', error);
    throw new Error(`Failed to parse PowerPoint presentation (.pptx): ${error.message || error}`);
  }
}

/**
 * Legacy DOC parser - extracts ASCII/Unicode text sequences from binary
 */
async function parseDoc(file: File): Promise<string> {
  const arrayBuffer = await readAsArrayBufferAsync(file);
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    let text = '';
    let currentWord: number[] = [];

    for (let i = 0; i < uint8.length; i++) {
      const charCode = uint8[i];
      // Keep common printable characters and basic whitespace (tab, LF, CR)
      if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
        currentWord.push(charCode);
      } else {
        // Minimum word length of 4 to screen out small binary fragments
        if (currentWord.length >= 4) {
          const word = String.fromCharCode(...currentWord);
          // Screen out XML nodes or standard headers to clean up output
          if (!/^[ \t\r\n]+$/.test(word) && !word.includes('<?xml') && !word.includes('<html')) {
            text += word + ' ';
          }
        }
        currentWord = [];
      }
    }
    
    if (currentWord.length >= 4) {
      text += String.fromCharCode(...currentWord);
    }

    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      throw new Error('No readable text could be extracted from this legacy Word document.');
    }
    
    return `[Extracted from legacy DOC file - Formatting might be simplified]\n\n${cleaned}`;
  } catch (error: any) {
    console.error('Error parsing DOC:', error);
    throw new Error(`Failed to parse legacy Word document (.doc): ${error.message || error}`);
  }
}

import jsPDF from 'jspdf';

let fontBase64Cache: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (fontBase64Cache) return fontBase64Cache;
  
  const response = await fetch(new URL('@/assets/fonts/Roboto-Regular.ttf', import.meta.url).href);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  fontBase64Cache = btoa(binary);
  return fontBase64Cache;
}

export async function registerSwedishFont(doc: jsPDF): Promise<void> {
  const base64 = await loadFontBase64();
  doc.addFileToVFS('Roboto-Regular.ttf', base64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', base64); // Use same font for bold (weight simulation)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  doc.setFont('Roboto');
}

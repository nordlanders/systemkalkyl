import jsPDF from 'jspdf';
import { registerSwedishFont } from './pdf-font';

// App colors from design system (HSL converted to RGB)
// Primary: hsl(222, 60%, 25%) → #19335A approx → rgb(25, 51, 90)
// Accent: hsl(199, 89%, 48%) → #0D8ECE approx → rgb(13, 142, 206)
// Muted foreground: hsl(220, 9%, 46%) → rgb(107, 114, 128)
const PRIMARY = { r: 21, g: 35, b: 64 };     // --primary #152340
const ACCENT = { r: 18, g: 159, b: 217 };    // --accent #129fd9
const MUTED_FG = { r: 107, g: 114, b: 128 };
const BG_LIGHT = { r: 243, g: 245, b: 248 }; // --background light
const ACCENT_LIGHT = { r: 232, g: 247, b: 253 }; // accent/10

interface GuideStep {
  title: string;
  description: string;
  details: string[];
  tip: string | null;
}

export async function generateGuidePdf(steps: GuideStep[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  await registerSwedishFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title page - primary background band
  doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
  doc.rect(0, 0, pageW, 100, 'F');

  // Accent line
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 100, pageW, 3, 'F');

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255);
  doc.text('Kalkylguide', pageW / 2, 55, { align: 'center' });

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(200, 220, 255);
  doc.text('Steg-för-steg-guide för att skapa kalkyler', pageW / 2, 68, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(MUTED_FG.r, MUTED_FG.g, MUTED_FG.b);
  doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, pageW / 2, 115, { align: 'center' });

  // Steps
  doc.addPage();
  y = margin;

  steps.forEach((step, idx) => {
    const stepNum = idx + 1;

    const detailLines = step.details.reduce((acc, d) => {
      return acc + doc.splitTextToSize(d, contentW - 12).length;
    }, 0);
    const tipLines = step.tip ? doc.splitTextToSize(step.tip, contentW - 12).length : 0;
    const descLines = doc.splitTextToSize(step.description, contentW).length;
    const estimatedH = 16 + descLines * 5 + detailLines * 6 + tipLines * 6 + 20;

    ensureSpace(estimatedH);

    // Step header - primary color
    doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    // Accent left stripe
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(margin, y, 3, 10, 'F');

    doc.setFont('Roboto', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text(`Steg ${stepNum}: ${step.title}`, margin + 7, y + 7);
    doc.setTextColor(0);
    y += 14;

    // Description
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED_FG.r, MUTED_FG.g, MUTED_FG.b);
    const descWrapped = doc.splitTextToSize(step.description, contentW);
    doc.text(descWrapped, margin, y);
    y += descWrapped.length * 5 + 4;
    doc.setTextColor(0);

    // Details
    step.details.forEach((detail) => {
      const lines = doc.splitTextToSize(detail, contentW - 12);
      ensureSpace(lines.length * 5 + 2);

      // Accent bullet
      doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.circle(margin + 3, y - 0.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
      doc.text(lines, margin + 8, y);
      y += lines.length * 5 + 2;
    });

    // Tip
    if (step.tip) {
      y += 2;
      ensureSpace(20);
      doc.setFillColor(ACCENT_LIGHT.r, ACCENT_LIGHT.g, ACCENT_LIGHT.b);
      doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
      const tipWrapped = doc.splitTextToSize(step.tip, contentW - 16);
      const tipH = tipWrapped.length * 5 + 8;
      doc.roundedRect(margin, y, contentW, tipH, 2, 2, 'FD');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text('Tips:', margin + 4, y + 5);
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
      doc.text(tipWrapped, margin + 16, y + 5);
      doc.setTextColor(0);
      doc.setDrawColor(0);
      y += tipH + 4;
    }

    y += 8;
  });

  doc.save('kalkylguide.pdf');
}

import jsPDF from 'jspdf';
import { registerSwedishFont } from './pdf-font';

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

  // Title page
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(24);
  doc.text('Kalkylguide', pageW / 2, 60, { align: 'center' });

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(12);
  doc.text('Steg-för-steg-guide för att skapa kalkyler', pageW / 2, 72, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, pageW / 2, 84, { align: 'center' });
  doc.setTextColor(0);

  // Steps
  doc.addPage();
  y = margin;

  steps.forEach((step, idx) => {
    const stepNum = idx + 1;

    // Estimate height needed
    const detailLines = step.details.reduce((acc, d) => {
      return acc + doc.splitTextToSize(d, contentW - 12).length;
    }, 0);
    const tipLines = step.tip ? doc.splitTextToSize(step.tip, contentW - 12).length : 0;
    const descLines = doc.splitTextToSize(step.description, contentW).length;
    const estimatedH = 16 + descLines * 5 + detailLines * 6 + tipLines * 6 + 20;

    ensureSpace(estimatedH);

    // Step header with colored background
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255);
    doc.text(`Steg ${stepNum}: ${step.title}`, margin + 4, y + 7);
    doc.setTextColor(0);
    y += 14;

    // Description
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    const descWrapped = doc.splitTextToSize(step.description, contentW);
    doc.text(descWrapped, margin, y);
    y += descWrapped.length * 5 + 4;
    doc.setTextColor(0);

    // Details
    step.details.forEach((detail) => {
      const lines = doc.splitTextToSize(detail, contentW - 12);
      ensureSpace(lines.length * 5 + 2);

      doc.setFillColor(239, 246, 255);
      doc.circle(margin + 3, y - 0.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(lines, margin + 8, y);
      y += lines.length * 5 + 2;
    });

    // Tip
    if (step.tip) {
      y += 2;
      ensureSpace(20);
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(251, 191, 36);
      const tipWrapped = doc.splitTextToSize(step.tip, contentW - 16);
      const tipH = tipWrapped.length * 5 + 8;
      doc.roundedRect(margin, y, contentW, tipH, 2, 2, 'FD');
      doc.setFont('Roboto', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(180, 130, 0);
      doc.text('Tips:', margin + 4, y + 5);
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(100, 80, 0);
      doc.text(tipWrapped, margin + 16, y + 5);
      doc.setTextColor(0);
      doc.setDrawColor(0);
      y += tipH + 4;
    }

    y += 8;
  });

  doc.save('kalkylguide.pdf');
}

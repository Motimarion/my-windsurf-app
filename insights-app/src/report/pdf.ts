// ייצוא PDF: הדוח מצויר ע"י הדפדפן עצמו (html2canvas), ולכן העברית, ה־RTL והגופן
// מוצגים בדיוק כמו במסך — בלי בעיות היפוך אותיות שיש ביצירת PDF טקסטואלי ב־jsPDF.
// מחיר: הטקסט ב־PDF הוא תמונה (לא ניתן לחיפוש). חלופה טקסטואלית: כפתור "הדפסה" → שמירה כ־PDF.

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 10;
const RENDER_WIDTH_PX = 820;

/** בוחר נקודות חיתוך בין עמודים בגבולות של כרטיסים, כדי לא לחתוך שורת טקסט. */
export function pageBreaks(total: number, pageH: number, candidates: number[]): number[] {
  const sorted = [...new Set(candidates)].filter((c) => c > 0 && c < total).sort((a, b) => a - b);
  const breaks: number[] = [0];
  let start = 0;
  while (total - start > pageH) {
    const limit = start + pageH;
    const ok = sorted.filter((c) => c <= limit && c > start + pageH * 0.35);
    const next = ok.length ? ok[ok.length - 1] : limit;
    breaks.push(next);
    start = next;
  }
  return breaks;
}

export async function exportPdf(root: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const prevWidth = root.style.width;
  root.classList.add('pdf-mode');
  root.style.width = `${RENDER_WIDTH_PX}px`;
  try {
    await document.fonts?.ready;
    const scale = 2;
    const canvas = await html2canvas(root, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const rootTop = root.getBoundingClientRect().top;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('.card, .section-title, .pdf-break')).map(
      (el) => Math.round((el.getBoundingClientRect().top - rootTop) * scale) - 8,
    );

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const contentW = A4_W_MM - MARGIN_MM * 2;
    const contentH = A4_H_MM - MARGIN_MM * 2;
    const pxPerMm = canvas.width / contentW;
    const pageHpx = Math.floor(contentH * pxPerMm);
    const breaks = pageBreaks(canvas.height, pageHpx, candidates);

    breaks.forEach((y, i) => {
      const h = Math.min((breaks[i + 1] ?? canvas.height) - y, pageHpx);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, contentW, h / pxPerMm);
      pdf.setFontSize(8);
      pdf.setTextColor(130);
      pdf.text(`${i + 1} / ${breaks.length}`, A4_W_MM / 2, A4_H_MM - 4, { align: 'center' });
    });
    pdf.save(filename);
  } finally {
    root.classList.remove('pdf-mode');
    root.style.width = prevWidth;
  }
}

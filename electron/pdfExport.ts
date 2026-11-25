import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs/promises';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function exportMarkdownAsPdf(title: string, markdownContent: string): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Session Report as PDF',
    defaultPath: `${title.replace(/[^a-z0-9\-_ ]/gi, '_')}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) {
    return null;
  }

  const htmlLines = markdownContent
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith('- [ ] ')) return `<div class="todo">&#9744; ${escapeHtml(line.slice(6))}</div>`;
      if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (!line.trim()) return '<br/>';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 36px; line-height: 1.55; font-size: 12px; }
  h1 { font-size: 20px; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 16px; }
  h2 { font-size: 14px; color: #0369a1; margin-top: 20px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  p, li, .todo { margin: 4px 0; }
  li { margin-left: 18px; }
</style>
</head>
<body>${htmlLines}</body>
</html>`;

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
    await fs.writeFile(filePath, pdfBuffer);
    return filePath;
  } finally {
    win.destroy();
  }
}

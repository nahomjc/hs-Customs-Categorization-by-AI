/**
 * Minimal PDF 1.4 writer (Helvetica, boxes, JPEG images). No native deps.
 * shortcut: Latin-1 / ASCII only (non-ASCII → ?); upgrade for Amharic fonts later.
 */

export type PdfRgb = { r: number; g: number; b: number };

function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avg = fontSize * 0.5;
  const maxChars = Math.max(8, Math.floor(maxWidth / avg));
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const paragraph of raw) {
    if (!paragraph) {
      out.push("");
      continue;
    }
    let rest = paragraph;
    while (rest.length > maxChars) {
      let breakAt = rest.lastIndexOf(" ", maxChars);
      if (breakAt < maxChars / 2) breakAt = maxChars;
      out.push(rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
    if (rest) out.push(rest);
  }
  return out.length ? out : [""];
}

/** Read JPEG width/height from SOF0/SOF2 marker. */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + len;
  }
  throw new Error("JPEG SOF not found");
}

type EmbeddedJpeg = {
  name: string;
  width: number;
  height: number;
  data: Buffer;
};

/** PDF user space: origin bottom-left. A4 = 595.28 x 841.89. */
export class SimplePdf {
  private pageStreams: string[] = [];
  private ops: string[] = [];
  private images: EmbeddedJpeg[] = [];
  private imageSeq = 0;
  readonly pageWidth = 595.28;
  readonly pageHeight = 841.89;

  beginPage() {
    if (this.ops.length) this.endPage();
    this.ops = [];
  }

  endPage() {
    this.pageStreams.push(this.ops.join("\n"));
    this.ops = [];
  }

  private yFromTop(topY: number): number {
    return this.pageHeight - topY;
  }

  setFill(color: PdfRgb) {
    this.ops.push(
      `${(color.r / 255).toFixed(3)} ${(color.g / 255).toFixed(3)} ${(color.b / 255).toFixed(3)} rg`,
    );
  }

  resetColor() {
    this.ops.push("0 0 0 rg");
    this.ops.push("0 0 0 RG");
  }

  rect(x: number, topY: number, w: number, h: number) {
    const y = this.yFromTop(topY) - h;
    this.ops.push(
      `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`,
    );
  }

  /** Draw label (teal) + body inside a box. */
  formBox(
    x: number,
    topY: number,
    w: number,
    h: number,
    title: string,
    body: string,
    opts: { labelColor?: PdfRgb; bodySize?: number } = {},
  ) {
    this.resetColor();
    this.rect(x, topY, w, h);
    const labelColor = opts.labelColor ?? { r: 0, g: 110, b: 110 };
    this.setFill(labelColor);
    this.text(title, x + 3, topY + 2, { size: 6, maxWidth: w - 6 });
    this.resetColor();
    this.text(body || " ", x + 3, topY + 11, {
      size: opts.bodySize ?? 8,
      maxWidth: w - 6,
      bold: true,
    });
    return topY + h;
  }

  text(
    str: string,
    x: number,
    topY: number,
    opts: {
      size?: number;
      maxWidth?: number;
      bold?: boolean;
      align?: "left" | "center";
    } = {},
  ): number {
    const size = opts.size ?? 9;
    const maxWidth = opts.maxWidth ?? 500;
    const font = opts.bold ? "/F2" : "/F1";
    const lines = wrapText(str, maxWidth, size);
    let lineTop = topY;
    for (const line of lines) {
      let drawX = x;
      if (opts.align === "center") {
        const approx = line.length * size * 0.45;
        drawX = x + Math.max(0, (maxWidth - approx) / 2);
      }
      const y = this.yFromTop(lineTop) - size;
      this.ops.push("BT");
      this.ops.push(`${font} ${size} Tf`);
      this.ops.push(`${drawX.toFixed(2)} ${y.toFixed(2)} Td`);
      this.ops.push(`(${pdfEscape(line)}) Tj`);
      this.ops.push("ET");
      lineTop += size * 1.2;
    }
    return lineTop;
  }

  registerJpeg(data: Buffer): string {
    const { width, height } = jpegSize(data);
    const name = `Im${++this.imageSeq}`;
    this.images.push({ name, width, height, data });
    return name;
  }

  drawJpeg(
    name: string,
    x: number,
    topY: number,
    displayW: number,
    displayH: number,
  ) {
    const y = this.yFromTop(topY) - displayH;
    this.ops.push("q");
    this.ops.push(
      `${displayW.toFixed(2)} 0 0 ${displayH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
    );
    this.ops.push(`/${name} Do`);
    this.ops.push("Q");
  }

  toBuffer(): Buffer {
    if (this.ops.length) this.endPage();
    if (this.pageStreams.length === 0) {
      this.beginPage();
      this.endPage();
    }

    const out: Buffer[] = [];
    let opos = 0;
    const ooff: number[] = [];
    const opush = (s: string | Buffer) => {
      const b = typeof s === "string" ? Buffer.from(s, "binary") : s;
      out.push(b);
      opos += b.length;
    };
    const ostart = (id: number) => {
      ooff[id] = opos;
      opush(`${id} 0 obj\n`);
    };
    const oend = () => opush("\nendobj\n");

    let id = 1;
    const catalog = id++;
    const pages = id++;
    const f1 = id++;
    const f2 = id++;
    const imgIdByName: Record<string, number> = {};
    for (const img of this.images) {
      imgIdByName[img.name] = id++;
    }
    const contentPagePairs: Array<{ content: number; page: number }> = [];
    for (let i = 0; i < this.pageStreams.length; i++) {
      contentPagePairs.push({ content: id++, page: id++ });
    }
    const maxId = id - 1;

    opush("%PDF-1.4\n");

    ostart(catalog);
    opush(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
    oend();

    ostart(pages);
    opush(
      `<< /Type /Pages /Kids [${contentPagePairs
        .map((p) => `${p.page} 0 R`)
        .join(" ")}] /Count ${contentPagePairs.length} >>`,
    );
    oend();

    ostart(f1);
    opush("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    oend();

    ostart(f2);
    opush("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    oend();

    for (const img of this.images) {
      const iid = imgIdByName[img.name];
      ostart(iid);
      opush(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`,
      );
      opush(img.data);
      opush("\nendstream");
      oend();
    }

    for (let i = 0; i < this.pageStreams.length; i++) {
      const { content, page } = contentPagePairs[i];
      const streamBuf = Buffer.from(this.pageStreams[i], "utf8");
      ostart(content);
      opush(`<< /Length ${streamBuf.length} >>\nstream\n`);
      opush(streamBuf);
      opush("\nendstream");
      oend();

      const xobjects =
        this.images.length > 0
          ? `/XObject << ${this.images
              .map((im) => `/${im.name} ${imgIdByName[im.name]} 0 R`)
              .join(" ")} >>`
          : "";

      ostart(page);
      opush(
        `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Contents ${content} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> ${xobjects} >> >>`,
      );
      oend();
    }

    const xrefPos = opos;
    opush(`xref\n0 ${maxId + 1}\n`);
    opush("0000000000 65535 f \n");
    for (let i = 1; i <= maxId; i++) {
      opush(`${String(ooff[i] ?? 0).padStart(10, "0")} 00000 n \n`);
    }
    opush(`trailer\n<< /Size ${maxId + 1} /Root ${catalog} 0 R >>\n`);
    opush(`startxref\n${xrefPos}\n%%EOF\n`);

    return Buffer.concat(out);
  }
}

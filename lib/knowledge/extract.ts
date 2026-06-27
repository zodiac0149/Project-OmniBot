import { PDFParse } from "pdf-parse";

export async function extractTextFromFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });

    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    file.type === "text/plain" ||
    file.name.toLowerCase().endsWith(".txt") ||
    file.name.toLowerCase().endsWith(".md")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error("Only PDF, TXT, and Markdown files are supported in Phase 3.");
}

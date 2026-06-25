import { NextResponse } from "next/server";
import { extractInvoiceFromPdf } from "@/lib/solar/pdf-extraction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const password = formData.get("password")?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo PDF obrigatorio" }, { status: 400 });
    }

    const data = await extractInvoiceFromPdf(file, password || undefined);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao extrair dados do PDF";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}


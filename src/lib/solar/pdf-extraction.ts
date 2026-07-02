import type { ExtractedInvoiceData, TariffFlag } from "./types";
import { parseBrazilianNumber } from "./format";

type RegexRule = {
  field: keyof ExtractedInvoiceData;
  patterns: RegExp[];
  transform?: (value: string) => string | number | TariffFlag;
};

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return undefined;
}

const number = (value: string) => parseBrazilianNumber(value);

const rules: RegexRule[] = [
  { field: "ucCode", patterns: [/(?:unidade consumidora|instalacao|uc|codigo do cliente)[\s:.-]+([0-9.\/-]{4,})/i] },
  { field: "clientName", patterns: [/(?:cliente|titular|nome)[\s:.-]+([A-ZÀ-Ú].{2,80}?)(?=\s+(?:cpf\/cnpj|cpf|cnpj|endereco|endereço|referencia|referência|vencimento|consumo|valor|uc)\b|$)/i] },
  { field: "document", patterns: [/(?:cpf\/cnpj|cpf)[\s:.-]+([0-9.\-/]{11,18})/i] },
  { field: "address", patterns: [/(?:endereco|endereço)[\s:.-]+([^\n]{8,140})/i] },
  { field: "email", patterns: [/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i] },
  { field: "phone", patterns: [/(?:telefone|fone|celular)[\s:.-]+(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/i] },
  { field: "referenceMonth", patterns: [/(?:mes de referencia|mês de referência|referencia|referência)[\s:.-]+([a-zç]+\/?\d{4}|\d{2}\/\d{4})/i] },
  { field: "dueDate", patterns: [/(?:vencimento|data de vencimento)[\s:.-]+(\d{2}\/\d{2}\/\d{4})/i], transform: brDateToIso },
  { field: "totalConsumptionKwh", patterns: [/(?:consumo total|total consumido|consumo faturado)[^\d]{0,24}([\d.,]+)\s?kwh/i], transform: number },
  { field: "solarConsumptionKwh", patterns: [/(?:energia solar consumida|energia compensada|geracao compartilhada|geração compartilhada)[^\d]{0,24}([\d.,]+)\s?kwh/i], transform: number },
  { field: "accumulatedCreditKwh", patterns: [/(?:credito solar acumulado|crédito solar acumulado|saldo acumulado|credito acumulado)[^\d]{0,24}([\d.,]+)\s?kwh/i], transform: number },
  { field: "utilityBillValue", patterns: [/(?:valor da fatura|total a pagar|valor total)[^\d]{0,20}R?\$?\s?([\d.,]+)/i], transform: number },
  { field: "publicLightingValue", patterns: [/(?:iluminacao publica|iluminação pública|cip|cosip)[^\d]{0,24}R?\$?\s?([\d.,]+)/i], transform: number },
  { field: "fioBValue", patterns: [/(?:fio b|tusd fio b|distribuicao|distribuição)[^\d]{0,24}R?\$?\s?([\d.,]+)/i], transform: number },
];

function brDateToIso(value: string) {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

function assignIfMissing<T extends keyof ExtractedInvoiceData>(
  data: ExtractedInvoiceData,
  field: T,
  value: ExtractedInvoiceData[T] | undefined
) {
  if (data[field] === undefined || data[field] === "") {
    data[field] = value;
  }
}

function cleanName(value?: string) {
  return value
    ?.replace(/\s+/g, " ")
    .replace(/\s+(?:CPF|CNPJ|IE|R\s+|RUA|AV\.?).*$/i, "")
    .trim();
}

function flagFromAdjustmentLabel(value?: string): TariffFlag | undefined {
  if (!value) return undefined;
  if (/VERM/i.test(value)) return "red";
  if (/AMAR/i.test(value)) return "yellow";
  if (/VERD/i.test(value)) return "green";
  return undefined;
}

function extractElektroLayout(text: string, data: ExtractedInvoiceData) {
  if (data.document && /\/0001-/.test(data.document) && text.indexOf(data.document.slice(0, 10)) < text.search(/INSC\.?\s+ESTADUAL/i)) {
    delete data.document;
  }

  const ucMatch = text.match(/\b(\d{7,10})\s+\d{7,10}\s+[A-ZÀ-Ú][A-ZÀ-Ú\s]{6,}\s+CPF\s*-/i)
    ?? text.match(/Segunda Via\s+(\d{7,10})\s+\d{2}\/\d{2}\/\d{4}\s+R\$/i);
  assignIfMissing(data, "ucCode", ucMatch?.[1]);

  const nameMatch = text.match(/\b\d{7,10}\s+\d{7,10}\s+([A-ZÀ-Ú][A-ZÀ-Ú\s]{6,}?)\s+CPF\s*-/i);
  assignIfMissing(data, "clientName", cleanName(nameMatch?.[1]));

  const customerDocument = text.match(/CPF\s*-\s*([0-9.\-/]{11,18})/i);
  assignIfMissing(data, "document", customerDocument?.[1]);
  if (!customerDocument && /CPF\s*-\s*\*+/i.test(text)) {
    data.document = "";
  }

  const addressMatch = text.match(/CPF\s*-\s*[*0-9.\-/]+\s+IE:\s+(.+?)\s+(?:RESIDENCIAL|Junho\/\d{4}|Janeiro\/\d{4}|Fevereiro\/\d{4}|Março\/\d{4}|Marco\/\d{4}|Abril\/\d{4}|Maio\/\d{4}|Julho\/\d{4}|Agosto\/\d{4}|Setembro\/\d{4}|Outubro\/\d{4}|Novembro\/\d{4}|Dezembro\/\d{4})/i);
  assignIfMissing(data, "address", addressMatch?.[1]?.replace(/\s+/g, " ").trim());

  const summaryMatch = text.match(/\b([A-Za-zÀ-ú]+\/\d{4})\s+R\$\s?([\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})/);
  assignIfMissing(data, "referenceMonth", summaryMatch?.[1]);
  assignIfMissing(data, "utilityBillValue", summaryMatch?.[2] ? number(summaryMatch[2]) : undefined);
  assignIfMissing(data, "dueDate", summaryMatch?.[3] ? brDateToIso(summaryMatch[3]) : undefined);

  const meterMatch = text.match(/CONSUMO\s+kWh\s+TP\s+\d+\s+\d+\s+\d+\s+([\d.,]+)/i);
  assignIfMissing(data, "totalConsumptionKwh", meterMatch?.[1] ? number(meterMatch[1]) : undefined);

  const lightingMatch = text.match(/CONSUMO TE\s+CONSUMO TUSD\s+AD\.B\.[A-Z.]+\s+COBRANCA ILUM PUBLICA PARA A PREFEITURA[\s\S]*?\b[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)\s+2,60/i)
    ?? text.match(/COBRANCA ILUM PUBLICA PARA A PREFEITURA\s+([\d.,]+)\s+0%/i);
  assignIfMissing(data, "publicLightingValue", lightingMatch?.[1] ? number(lightingMatch[1]) : undefined);

  const tariffColumnMatch = text.match(/AD\.B\.(AMAR|VERM|VERDE)[A-Z.]*[\s\S]*?kWh\s+kWh\s+kWh\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)/i);
  const tariffLineMatch = text.match(/AD\.B\.(AMAR|VERM|VERDE)[A-Z.]*\s+kWh\s+[\d.,]+\s+([\d.,]+)\s+([\d.,]+)/i);
  const tariffMatch = tariffColumnMatch ?? tariffLineMatch;

  if (tariffMatch) {
    const flag = flagFromAdjustmentLabel(tariffMatch[1]);
    const rate = number(tariffMatch[2]);
    const total = number(tariffMatch[3]);

    assignIfMissing(data, "tariffFlag", flag);
    assignIfMissing(data, "tariffFlagValue", rate);
    assignIfMissing(data, "tariffFlagChargeValue", total);
  }
}

function detectTariffFlag(text: string): TariffFlag | undefined {
  if (/bandeira\s*tarifaria\s+vermelha|bandeira\s+vermelha|AD\.B\.VERM/i.test(text)) return "red";
  if (/bandeira\s*tarifaria\s+amarela|bandeira\s+amarela|AD\.B\.AMAR/i.test(text)) return "yellow";
  if (/bandeira\s*tarifaria\s+verde|bandeira\s+verde/i.test(text)) return "green";
  return undefined;
}

async function ensurePdfServerPolyfills() {
  if (
    typeof globalThis.DOMMatrix !== "undefined"
    && typeof globalThis.ImageData !== "undefined"
    && typeof globalThis.Path2D !== "undefined"
  ) {
    return;
  }

  const canvas = await import("@napi-rs/canvas");
  const target = globalThis as Record<string, unknown>;

  target.DOMMatrix ??= canvas.DOMMatrix;
  target.ImageData ??= canvas.ImageData;
  target.Path2D ??= canvas.Path2D;
}

export async function extractInvoiceFromPdf(file: File, password?: string): Promise<ExtractedInvoiceData> {
  await ensurePdfServerPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({
    data: bytes,
    password,
    disableFontFace: true,
    disableWorker: true,
    useSystemFonts: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }

  const text = pages.join("\n").replace(/\s+/g, " ");
  const data: ExtractedInvoiceData = { rawTextSample: text.slice(0, 1200) };

  for (const rule of rules) {
    const match = firstMatch(text, rule.patterns);
    if (match) {
      data[rule.field] = (rule.transform ? rule.transform(match) : match) as never;
    }
  }

  extractElektroLayout(text, data);
  data.tariffFlag = detectTariffFlag(text);

  if (!data.solarConsumptionKwh && data.totalConsumptionKwh) {
    data.solarConsumptionKwh = data.totalConsumptionKwh;
  }

  const requiredFields: Array<keyof ExtractedInvoiceData> = [
    "ucCode",
    "clientName",
    "referenceMonth",
    "dueDate",
    "totalConsumptionKwh",
    "solarConsumptionKwh",
    "utilityBillValue",
  ];

  data.missingFields = requiredFields.filter((field) => data[field] === undefined || data[field] === "");
  return data;
}

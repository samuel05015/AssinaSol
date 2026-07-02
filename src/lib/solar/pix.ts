import { onlyDigits } from "./format";

function emv(id: string, value: string) {
  return `${id}${String(new TextEncoder().encode(value).length).padStart(2, "0")}${value}`;
}

function sanitizePixText(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .toUpperCase();
}

function normalizePixKey(value: string) {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);

  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (trimmed.startsWith("+") && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`;
  }
  if ((trimmed.includes("(") || trimmed.toLowerCase().includes("tel")) && digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`;
  }
  if (digits.length === 11 || digits.length === 14) return digits;

  return trimmed;
}

function sanitizeTxid(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 25)
    .toUpperCase() || "ASSINASOL";
}

function crc16(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixCopyPaste(input: {
  pixKey?: string;
  receiverName?: string;
  amount: number;
  invoiceNumber: string;
  city?: string;
}) {
  const pixKey = normalizePixKey(input.pixKey ?? "");
  const receiverName = input.receiverName?.trim();
  if (!pixKey || !receiverName || input.amount <= 0) return "";

  const merchantAccount = [
    emv("00", "br.gov.bcb.pix"),
    emv("01", pixKey),
  ].join("");
  const txid = sanitizeTxid(input.invoiceNumber);
  const amount = Math.max(0, input.amount).toFixed(2);
  const payload = [
    emv("00", "01"),
    emv("26", merchantAccount),
    emv("52", "0000"),
    emv("53", "986"),
    emv("54", amount),
    emv("58", "BR"),
    emv("59", sanitizePixText(receiverName, 25) || "RECEBEDOR"),
    emv("60", sanitizePixText(input.city || "SAO PAULO", 15) || "SAO PAULO"),
    emv("62", emv("05", txid)),
  ].join("");
  const withCrcId = `${payload}6304`;

  return `${withCrcId}${crc16(withCrcId)}`;
}

export function buildInvoiceEmailLink(input: {
  email?: string;
  clientName: string;
  invoiceNumber: string;
  referenceMonth: string;
  total: string;
  pdfUrl?: string;
  companyName: string;
}) {
  const subject = `Fatura Solar ${input.invoiceNumber} - ${input.referenceMonth}`;
  const body = [
    `Olá, ${input.clientName}.`,
    "",
    `Segue sua fatura solar ${input.invoiceNumber}, referente a ${input.referenceMonth}, no valor de ${input.total}.`,
    input.pdfUrl ? `PDF: ${input.pdfUrl}` : "",
    "",
    input.companyName,
  ].filter(Boolean).join("\n");

  return `mailto:${encodeURIComponent(input.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildInvoiceWhatsappLink(input: {
  phone?: string;
  clientName: string;
  invoiceNumber: string;
  referenceMonth: string;
  total: string;
  dueDate?: string;
  pixKey?: string;
  pdfUrl?: string;
  companyName: string;
}) {
  const phone = onlyDigits(input.phone);
  const message = [
    `Olá, ${input.clientName}.`,
    `Sua fatura solar ${input.invoiceNumber} referente a ${input.referenceMonth} ficou em ${input.total}.`,
    input.dueDate ? `Vencimento: ${input.dueDate}.` : "",
    input.pixKey ? `PIX: ${input.pixKey}.` : "",
    input.pdfUrl ? `PDF: ${input.pdfUrl}` : "",
    input.companyName,
  ].filter(Boolean).join("\n");

  return `https://wa.me/${phone ? `55${phone}` : ""}?text=${encodeURIComponent(message)}`;
}

import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { appBrand } from "@/lib/brand";
import type { InvoiceCalculationInput, InvoiceCalculationResult, PdfBrandSettings } from "./types";
import { formatCurrency, formatKwh, formatNumber } from "./format";
import { buildPixCopyPaste } from "./pix";

const A4 = { width: 595.28, height: 841.89 };
const colors = {
  navy: rgb(0.05, 0.12, 0.22),
  orange: rgb(0.94, 0.38, 0.08),
  paleOrange: rgb(1, 0.91, 0.84),
  gray: rgb(0.42, 0.45, 0.5),
  lightGray: rgb(0.94, 0.96, 0.98),
  white: rgb(1, 1, 1),
  green: rgb(0.06, 0.5, 0.33),
};

const tariffFlagLabels = {
  green: "Verde",
  yellow: "Amarela",
  red: "Vermelha",
};

const defaultBrand: PdfBrandSettings = {
  companyName: appBrand.name,
  companyEmail: "",
  companyPhone: "",
  companyDocument: "",
  companyLogoUrl: "",
  proposalColor: "#f97316",
  proposalLayout: "modern",
};

type PdfContext = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
};

function addPage(ctx: PdfContext) {
  ctx.page = ctx.doc.addPage([A4.width, A4.height]);
  ctx.y = A4.height - 42;
}

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function drawText(ctx: PdfContext, text: string, x: number, y: number, options?: {
  size?: number;
  color?: ReturnType<typeof rgb>;
  font?: PDFFont;
  maxWidth?: number;
  lineHeight?: number;
}) {
  const size = options?.size ?? 10;
  const font = options?.font ?? ctx.regular;
  const lineHeight = options?.lineHeight ?? size + 4;
  const maxWidth = options?.maxWidth;

  if (!maxWidth) {
    ctx.page.drawText(text, { x, y, size, font, color: options?.color ?? colors.navy });
    return lineHeight;
  }

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (textWidth(font, test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  lines.forEach((line, index) => {
    ctx.page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: options?.color ?? colors.navy,
    });
  });

  return lines.length * lineHeight;
}

function ensureSpace(ctx: PdfContext, height: number) {
  if (ctx.y - height < 54) {
    addPage(ctx);
  }
}

function sectionTitle(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 34);
  ctx.page.drawRectangle({ x: 42, y: ctx.y - 24, width: 511, height: 24, color: colors.lightGray });
  drawText(ctx, title, 54, ctx.y - 16, { size: 11, font: ctx.bold, color: colors.navy });
  ctx.y -= 40;
}

function drawKeyValueAt(ctx: PdfContext, label: string, value: string, x: number, y: number, width: number) {
  drawText(ctx, label, x, y, { size: 7, color: colors.gray, font: ctx.bold });
  const used = drawText(ctx, value || "-", x, y - 13, { size: 10, font: ctx.bold, maxWidth: width, lineHeight: 13 });
  return used + 20;
}

function tableRow(ctx: PdfContext, label: string, value: string, shaded = false) {
  ensureSpace(ctx, 24);
  if (shaded) {
    ctx.page.drawRectangle({ x: 42, y: ctx.y - 16, width: 511, height: 22, color: colors.lightGray });
  }
  drawText(ctx, label, 54, ctx.y - 10, { size: 9, maxWidth: 360 });
  const valueWidth = textWidth(ctx.bold, value, 9);
  drawText(ctx, value, 540 - valueWidth, ctx.y - 10, { size: 9, font: ctx.bold });
  ctx.y -= 23;
}

function drawMetricCard(ctx: PdfContext, title: string, value: string, x: number, y: number, width: number, tone: "default" | "orange" | "green" = "default") {
  const fill = tone === "orange" ? colors.paleOrange : tone === "green" ? rgb(0.9, 0.98, 0.93) : colors.lightGray;
  const accent = tone === "orange" ? colors.orange : tone === "green" ? colors.green : colors.navy;

  ctx.page.drawRectangle({ x, y: y - 58, width, height: 58, color: fill });
  drawText(ctx, title, x + 12, y - 18, { size: 8, color: colors.gray, font: ctx.bold, maxWidth: width - 24 });
  drawText(ctx, value, x + 12, y - 41, { size: 15, color: accent, font: ctx.bold, maxWidth: width - 24 });
}

function roundPdfMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function colorFromHex(hex?: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex ?? "") ? hex as string : defaultBrand.proposalColor;
  const red = parseInt(normalized.slice(1, 3), 16) / 255;
  const green = parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = parseInt(normalized.slice(5, 7), 16) / 255;
  return rgb(red, green, blue);
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "AS";
}

async function embedLogo(doc: PDFDocument, settings: PdfBrandSettings) {
  if (!settings.logoBytes?.length) return null;

  try {
    if (settings.logoContentType?.includes("png")) return await doc.embedPng(settings.logoBytes);
    if (settings.logoContentType?.includes("jpeg") || settings.logoContentType?.includes("jpg")) return await doc.embedJpg(settings.logoBytes);
  } catch {
    return null;
  }

  return null;
}

async function embedQrCode(doc: PDFDocument, payload: string) {
  if (!payload) return null;

  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    });
    const base64 = dataUrl.split(",")[1];
    return await doc.embedPng(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}

function drawFittedLogo(ctx: PdfContext, logo: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  ctx.page.drawImage(logo, {
    x: x + (maxWidth - width) / 2,
    y: y + (maxHeight - height) / 2,
    width,
    height,
  });
}

export async function buildInvoicePdf(input: InvoiceCalculationInput, calculation: InvoiceCalculationResult, brandSettings?: PdfBrandSettings) {
  const brand = { ...defaultBrand, ...brandSettings };
  const accent = colorFromHex(brand.proposalColor);
  const headerHeight = brand.proposalLayout === "compact" ? 92 : 118;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(doc, brand);
  const pixCopyPaste = buildPixCopyPaste({
    pixKey: input.pixKey,
    receiverName: input.receiverName,
    amount: calculation.finalTotal,
    invoiceNumber: calculation.invoiceNumber,
  });
  const pixQrCode = await embedQrCode(doc, pixCopyPaste);
  const ctx: PdfContext = {
    doc,
    page: doc.addPage([A4.width, A4.height]),
    regular,
    bold,
    y: A4.height - 42,
  };

  const classic = brand.proposalLayout === "classic";
  const headerY = A4.height - headerHeight;
  ctx.page.drawRectangle({ x: 0, y: headerY, width: A4.width, height: headerHeight, color: classic ? colors.white : colors.navy });
  ctx.page.drawRectangle({ x: 0, y: headerY, width: A4.width, height: 5, color: accent });

  const logoBoxY = A4.height - (brand.proposalLayout === "compact" ? 70 : 82);
  if (logo) {
    ctx.page.drawRectangle({ x: 50, y: logoBoxY, width: 46, height: 46, color: classic ? colors.lightGray : colors.white });
    drawFittedLogo(ctx, logo, 55, logoBoxY + 5, 36, 36);
  } else {
    ctx.page.drawCircle({ x: 73, y: logoBoxY + 23, size: 23, color: accent });
    drawText(ctx, initials(brand.companyName), 63, logoBoxY + 17, { size: 14, font: bold, color: colors.white });
  }

  const headerTextColor = classic ? colors.navy : colors.white;
  drawText(ctx, brand.companyName, 108, A4.height - 46, { size: 16, font: bold, color: headerTextColor, maxWidth: 250 });
  drawText(ctx, brand.proposalLayout === "compact" ? "Proposta Solar" : "Fatura Solar", 108, A4.height - 70, { size: brand.proposalLayout === "compact" ? 20 : 24, font: bold, color: headerTextColor });
  const brandContact = [brand.companyDocument ? `CNPJ ${brand.companyDocument}` : "", brand.companyPhone, brand.companyEmail].filter(Boolean).join(" | ");
  drawText(ctx, brandContact || "Documento financeiro gerado automaticamente", 108, A4.height - 91, { size: 8.5, color: headerTextColor, maxWidth: 280 });

  drawText(ctx, `N. ${calculation.invoiceNumber}`, 405, A4.height - 48, { size: 10, font: bold, color: headerTextColor });
  drawText(ctx, `Emissao: ${new Date().toLocaleDateString("pt-BR")}`, 405, A4.height - 66, { size: 9, color: headerTextColor });
  drawText(ctx, `Referencia: ${input.referenceMonth}`, 405, A4.height - 82, { size: 9, color: headerTextColor });
  if (brand.proposalLayout !== "compact") {
    drawText(ctx, `Vencimento: ${new Date(`${input.dueDate}T00:00:00`).toLocaleDateString("pt-BR")}`, 405, A4.height - 98, { size: 9, color: headerTextColor });
  }

  ctx.y = A4.height - headerHeight - 30;
  sectionTitle(ctx, "Dados do cliente");
  const leftX = 54;
  const rightX = 310;
  const colWidth = 232;
  const rowTop = ctx.y;
  let leftY = rowTop;
  let rightY = rowTop;

  leftY -= drawKeyValueAt(ctx, "Nome", input.client.name, leftX, leftY, colWidth);
  leftY -= drawKeyValueAt(ctx, "CPF/CNPJ", input.client.document || "-", leftX, leftY, colWidth);
  leftY -= drawKeyValueAt(ctx, "Unidade Consumidora", input.client.ucCode, leftX, leftY, colWidth);

  rightY -= drawKeyValueAt(ctx, "Endereco", input.client.address || "-", rightX, rightY, colWidth);
  rightY -= drawKeyValueAt(ctx, "Telefone", input.client.phone || "-", rightX, rightY, colWidth);
  rightY -= drawKeyValueAt(ctx, "E-mail", input.client.email || "-", rightX, rightY, colWidth);

  ctx.y = Math.min(leftY, rightY) - 18;

  sectionTitle(ctx, "Resumo da fatura");
  tableRow(ctx, "Energia solar consumida", formatKwh(input.solarConsumptionKwh), true);
  tableRow(ctx, "Preco por kWh", formatCurrency(input.pricePerKwh));
  tableRow(ctx, "Subtotal da energia", formatCurrency(calculation.energySubtotal), true);
  tableRow(ctx, `Desconto percentual (${formatNumber(input.discountPercent, 2)}%)`, `-${formatCurrency(calculation.discountValue)}`);
  tableRow(ctx, "Total da energia com desconto", formatCurrency(calculation.energyTotal), true);
  if (input.chargeFioB) tableRow(ctx, "Fio B - Distribuicao", formatCurrency(input.fioBValue));
  if (input.chargePublicLighting) tableRow(ctx, "Taxa de iluminacao publica", formatCurrency(input.publicLightingValue), true);
  if (calculation.tariffFlagCost > 0) tableRow(ctx, `Bandeira tarifaria ${tariffFlagLabels[input.tariffFlag]}`, formatCurrency(calculation.tariffFlagCost));
  if (input.chargeUtilityBill) tableRow(ctx, "Fatura cobrada pela concessionaria", formatCurrency(input.utilityBillValue));
  input.adjustments.forEach((item, index) => {
    tableRow(ctx, `${item.type === "fee" ? "Taxa" : "Desconto"} - ${item.name}`, `${item.type === "discount" ? "-" : ""}${formatCurrency(item.amount)}`, index % 2 === 0);
  });
  input.lateFees.filter((fee) => fee.status === "pending").forEach((fee) => {
    tableRow(ctx, `Multa/juros - ${fee.originalInvoiceReference}`, formatCurrency(fee.totalAmount));
  });

  ensureSpace(ctx, 70);
  ctx.page.drawRectangle({ x: 42, y: ctx.y - 54, width: 511, height: 54, color: colors.paleOrange });
  drawText(ctx, "Valor final", 54, ctx.y - 20, { size: 11, font: bold, color: accent });
  const finalText = formatCurrency(calculation.finalTotal);
  drawText(ctx, finalText, 540 - textWidth(bold, finalText, 24), ctx.y - 31, { size: 24, font: bold, color: accent });
  ctx.y -= 78;

  sectionTitle(ctx, "Demonstrativo Comparativo");
  const totalBeforeEnergyDiscount = roundPdfMoney(calculation.finalTotal + calculation.discountValue);
  ensureSpace(ctx, 116);
  ctx.page.drawRectangle({ x: 42, y: ctx.y - 104, width: 511, height: 104, color: colors.lightGray });
  drawText(ctx, "Comparativo do valor total", 54, ctx.y - 18, { size: 10, font: ctx.bold, color: colors.navy });
  drawText(ctx, "Total da proposta antes e depois do desconto aplicado somente na energia solar.", 54, ctx.y - 34, { size: 8, color: colors.gray, maxWidth: 480 });
  drawMetricCard(ctx, "Total sem desconto", formatCurrency(totalBeforeEnergyDiscount), 54, ctx.y - 58, 145);
  drawMetricCard(ctx, "Desconto aplicado", `-${formatCurrency(calculation.discountValue)}`, 222, ctx.y - 58, 145, "orange");
  drawMetricCard(ctx, "Total com desconto", formatCurrency(calculation.finalTotal), 390, ctx.y - 58, 145, "green");
  ctx.y -= 126;

  addPage(ctx);
  sectionTitle(ctx, "Resolucao da Proposta");
  calculation.resolutionLines.forEach((line, index) => {
    ensureSpace(ctx, 28);
    const used = drawText(ctx, `${index + 1}. ${line}`, 54, ctx.y, { size: 9, maxWidth: 485 });
    ctx.y -= used + 4;
  });
  const explanation = "O desconto aplicado nesta proposta incide somente sobre o valor da energia solar consumida. Taxas, encargos, Fio B, iluminacao publica, valores da concessionaria e multas/juros sao somados separadamente quando configurados.";
  ensureSpace(ctx, 50);
  ctx.page.drawRectangle({ x: 42, y: ctx.y - 44, width: 511, height: 44, color: colors.lightGray });
  drawText(ctx, explanation, 54, ctx.y - 15, { size: 8.5, maxWidth: 486, color: colors.gray });
  ctx.y -= 66;

  sectionTitle(ctx, "Comparativo de Economia");
  tableRow(ctx, "Bandeira tarifaria selecionada", tariffFlagLabels[input.tariffFlag], true);
  tableRow(ctx, "Taxa da bandeira informada", `${formatCurrency(calculation.selectedTariffValue)}/kWh`);
  tableRow(
    ctx,
    "Calculo estimado da concessionaria",
    `${formatKwh(input.solarConsumptionKwh)} x ${formatCurrency(calculation.selectedTariffValue)} = ${formatCurrency(calculation.estimatedUtilityCost)}`,
    true
  );
  tableRow(ctx, "Valor estimado da energia pela concessionaria", formatCurrency(calculation.estimatedUtilityCost), true);
  tableRow(ctx, "Valor cobrado pela energia solar", formatCurrency(calculation.energyTotal));
  tableRow(ctx, "Economia estimada", formatCurrency(calculation.estimatedSavings), true);
  if (calculation.savingsPercent !== null) {
    tableRow(ctx, "Percentual de economia", `${formatNumber(calculation.savingsPercent, 2)}%`);
  }

  if (input.pixKey) {
    sectionTitle(ctx, "PIX");
    ensureSpace(ctx, pixQrCode ? 150 : 86);
    if (pixQrCode) {
      ctx.page.drawRectangle({ x: 42, y: ctx.y - 132, width: 511, height: 132, color: colors.lightGray });
      drawFittedLogo(ctx, pixQrCode, 430, ctx.y - 118, 96, 96);
      drawText(ctx, "Pagamento via PIX", 54, ctx.y - 18, { size: 11, font: bold, color: colors.navy });
      drawText(ctx, `Chave: ${input.pixKey}`, 54, ctx.y - 38, { size: 9, maxWidth: 340 });
      drawText(ctx, `Recebedor: ${input.receiverName || "-"}`, 54, ctx.y - 56, { size: 9, maxWidth: 340 });
      drawText(ctx, `Valor total: ${formatCurrency(calculation.finalTotal)}`, 54, ctx.y - 74, { size: 10, font: bold, color: accent });
      drawText(ctx, "PIX copia e cola:", 54, ctx.y - 96, { size: 8, color: colors.gray, font: bold });
      drawText(ctx, pixCopyPaste, 54, ctx.y - 110, { size: 6.5, maxWidth: 350, color: colors.gray, lineHeight: 8 });
      ctx.y -= 154;
    } else {
      tableRow(ctx, "Chave PIX", input.pixKey, true);
      tableRow(ctx, "Recebedor", input.receiverName || "-");
      tableRow(ctx, "Valor total", formatCurrency(calculation.finalTotal), true);
    }
  }

  if (input.notes) {
    sectionTitle(ctx, "Observacoes");
    const used = drawText(ctx, input.notes, 54, ctx.y, { size: 10, maxWidth: 485 });
    ctx.y -= used + 24;
  }

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    page.drawLine({ start: { x: 42, y: 38 }, end: { x: 553, y: 38 }, thickness: 0.8, color: accent });
    page.drawText(`Este documento foi gerado automaticamente pelo sistema ${appBrand.name} para ${brand.companyName}.`, {
      x: 42,
      y: 22,
      size: 8,
      font: regular,
      color: colors.gray,
    });
    page.drawText(`${index + 1}/${pages.length}`, {
      x: 530,
      y: 22,
      size: 8,
      font: regular,
      color: colors.gray,
    });
  });

  return doc.save();
}

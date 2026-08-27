import type { InvoiceCalculationInput, InvoiceCalculationResult, LateFeeRecord } from "./types";
import { formatCurrency, formatKwh, formatNumber } from "./format";

export function roundCurrency(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateLateFee(input: {
  originalDueDate: string;
  paymentDate: string;
  originalAmount: number;
  finePercent: number;
  interestPercent: number;
  interestType: "monthly" | "daily";
}) {
  const due = new Date(`${input.originalDueDate}T00:00:00`);
  const paid = new Date(`${input.paymentDate}T00:00:00`);
  const diffMs = paid.getTime() - due.getTime();
  const daysLate = Math.max(0, Math.ceil(diffMs / 86_400_000));
  const fineAmount = roundCurrency(input.originalAmount * (input.finePercent / 100));
  const dailyRate = input.interestType === "monthly" ? input.interestPercent / 30 : input.interestPercent;
  const interestAmount = roundCurrency(input.originalAmount * (dailyRate / 100) * daysLate);

  return {
    daysLate,
    fineAmount,
    interestAmount,
    totalAmount: roundCurrency(fineAmount + interestAmount),
  };
}

function sum(values: number[]) {
  return roundCurrency(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0));
}

export function calculateInvoice(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const invoiceNumber = input.invoiceNumber || `SOL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const energySubtotal = roundCurrency(input.solarConsumptionKwh * input.pricePerKwh);
  const discountValue = roundCurrency(energySubtotal * (input.discountPercent / 100));
  const energyTotal = roundCurrency(energySubtotal - discountValue);
  const selectedTariffValue = input.tariffValues[input.tariffFlag] ?? 0;
  const tariffFlagCost = roundCurrency(input.solarConsumptionKwh * selectedTariffValue);

  const totalFees = sum([
    input.chargeFioB ? input.fioBValue : 0,
    input.chargePublicLighting ? input.publicLightingValue : 0,
    input.chargeUtilityBill ? input.utilityBillValue : 0,
    tariffFlagCost,
  ]);

  const totalExtraFees = sum(input.adjustments.filter((item) => item.type === "fee").map((item) => item.amount));
  const totalExtraDiscounts = sum(input.adjustments.filter((item) => item.type === "discount").map((item) => item.amount));
  const totalAdjustments = roundCurrency(totalExtraFees - totalExtraDiscounts);
  const totalLateFees = sum(input.lateFees.filter((fee) => fee.status === "pending").map((fee) => fee.totalAmount));
  const finalTotal = roundCurrency(energyTotal + totalFees + totalAdjustments + totalLateFees);

  const estimatedUtilityCost = tariffFlagCost;
  const estimatedSavings = roundCurrency(estimatedUtilityCost - energyTotal);
  const savingsPercent = estimatedUtilityCost > 0
    ? roundCurrency((estimatedSavings / estimatedUtilityCost) * 100)
    : null;

  const feeLines = [
    input.chargeFioB ? `Fio B: ${formatCurrency(input.fioBValue)}` : null,
    input.chargePublicLighting ? `Iluminacao publica: ${formatCurrency(input.publicLightingValue)}` : null,
    input.chargeUtilityBill ? `Fatura da concessionaria: ${formatCurrency(input.utilityBillValue)}` : null,
    tariffFlagCost > 0 ? `Bandeira tarifaria: ${formatCurrency(tariffFlagCost)}` : null,
    ...input.adjustments.filter((item) => item.type === "fee").map((item) => `${item.name}: ${formatCurrency(item.amount)}`),
  ].filter(Boolean) as string[];

  const discountLines = input.adjustments
    .filter((item) => item.type === "discount")
    .map((item) => `${item.name}: ${formatCurrency(item.amount)}`);

  const lateFeeLines = input.lateFees
    .filter((fee) => fee.status === "pending")
    .map((fee: LateFeeRecord) => `${fee.originalInvoiceReference}: ${formatCurrency(fee.totalAmount)} (${fee.daysLate} dias)`);

  return {
    invoiceNumber,
    energySubtotal,
    discountValue,
    energyTotal,
    totalFees,
    totalExtraFees,
    totalExtraDiscounts,
    totalAdjustments,
    totalLateFees,
    finalTotal,
    selectedTariffValue,
    tariffFlagCost,
    estimatedUtilityCost,
    estimatedSavings,
    savingsPercent,
    resolutionLines: [
      `Energia solar considerada: ${formatKwh(input.solarConsumptionKwh)}`,
      `Valor do kWh contratado: ${formatCurrency(input.pricePerKwh)}`,
      `Calculo da energia: ${formatNumber(input.solarConsumptionKwh, 2)} kWh x ${formatCurrency(input.pricePerKwh)} = ${formatCurrency(energySubtotal)}`,
      `Desconto aplicado: ${formatCurrency(energySubtotal)} x ${formatNumber(input.discountPercent, 2)}% = ${formatCurrency(discountValue)}`,
      `Energia com desconto: ${formatCurrency(energySubtotal)} - ${formatCurrency(discountValue)} = ${formatCurrency(energyTotal)}`,
      `Taxas adicionais: ${feeLines.length ? feeLines.join("; ") : "nenhuma taxa adicional cobrada"}`,
      `Descontos adicionais: ${discountLines.length ? discountLines.join("; ") : "nenhum desconto adicional"}`,
      `Multa e juros: ${lateFeeLines.length ? lateFeeLines.join("; ") : "nenhum valor pendente"}`,
      `Total final: ${formatCurrency(energyTotal)} + ${formatCurrency(totalFees)} + ${formatCurrency(totalAdjustments)} + ${formatCurrency(totalLateFees)} = ${formatCurrency(finalTotal)}`,
    ],
  };
}

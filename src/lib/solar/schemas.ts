import { z } from "zod";
import { onlyDigits } from "./format";

const optionalString = z.string().trim().optional().or(z.literal(""));
const nonNegativeNumber = z.coerce.number().min(0, "Informe um valor maior ou igual a zero");

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calcDigit = (base: string, factor: number) => {
    const total = base.split("").reduce((sum, digit) => {
      const next = sum + Number(digit) * factor;
      factor -= 1;
      return next;
    }, 0);
    const mod = (total * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calcDigit(cpf.slice(0, 9), 10) === Number(cpf[9])
    && calcDigit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (base: string, factors: number[]) => {
    const total = base.split("").reduce((sum, digit, index) => sum + Number(digit) * factors[index], 0);
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const first = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calcDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

export const clientSchema = z.object({
  id: optionalString,
  ucCode: z.string().trim().min(1, "UC obrigatoria"),
  name: z.string().trim().min(1, "Nome obrigatorio"),
  document: optionalString.refine((value) => {
    if (!value) return true;
    const digits = onlyDigits(value);
    return digits.length === 11 ? isValidCpf(value) : digits.length === 14 ? isValidCnpj(value) : false;
  }, "CPF/CNPJ invalido"),
  email: optionalString.refine((value) => !value || z.string().email().safeParse(value).success, "E-mail invalido"),
  phone: optionalString,
  address: optionalString,
});

export const invoiceAdjustmentSchema = z.object({
  id: optionalString,
  type: z.enum(["fee", "discount"]),
  name: z.string().trim().min(1, "Informe o nome"),
  amount: nonNegativeNumber,
});

export const lateFeeInputSchema = z.object({
  clientId: optionalString,
  originalInvoiceReference: z.string().trim().min(1, "Mes de referencia obrigatorio"),
  originalDueDate: z.string().min(1, "Vencimento obrigatorio"),
  paymentDate: z.string().min(1, "Data de pagamento obrigatoria"),
  originalAmount: nonNegativeNumber,
  finePercent: nonNegativeNumber,
  interestPercent: nonNegativeNumber,
  interestType: z.enum(["monthly", "daily"]),
});

export const lateFeeRecordSchema = lateFeeInputSchema.extend({
  id: optionalString,
  daysLate: nonNegativeNumber,
  fineAmount: nonNegativeNumber,
  interestAmount: nonNegativeNumber,
  totalAmount: nonNegativeNumber,
  status: z.enum(["pending", "included", "canceled"]),
});

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Nome da empresa obrigatorio"),
  companyEmail: optionalString.refine((value) => !value || z.string().email().safeParse(value).success, "E-mail invalido"),
  companyPhone: optionalString,
  companyDocument: z.string().trim().min(1, "CNPJ obrigatorio").refine((value) => isValidCnpj(value), "CNPJ invalido"),
  companyLogoUrl: optionalString,
  proposalColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Selecione uma cor valida"),
  proposalLayout: z.enum(["modern", "classic", "compact"]),
});

export const invoiceCalculationSchema = z.object({
  client: clientSchema,
  invoiceNumber: optionalString,
  referenceMonth: z.string().trim().min(1, "Mes de referencia obrigatorio"),
  dueDate: z.string().min(1, "Vencimento obrigatorio"),
  totalConsumptionKwh: nonNegativeNumber.optional(),
  solarConsumptionKwh: z.coerce.number().positive("Energia solar consumida obrigatoria"),
  accumulatedCreditKwh: nonNegativeNumber.optional(),
  pricePerKwh: z.coerce.number().positive("Preco por kWh obrigatorio"),
  discountPercent: nonNegativeNumber,
  fioBValue: nonNegativeNumber,
  chargeFioB: z.coerce.boolean(),
  publicLightingValue: nonNegativeNumber,
  chargePublicLighting: z.coerce.boolean(),
  utilityBillValue: nonNegativeNumber,
  chargeUtilityBill: z.coerce.boolean(),
  tariffFlag: z.enum(["green", "yellow", "red"]),
  tariffValues: z.object({
    green: nonNegativeNumber,
    yellow: nonNegativeNumber,
    red: nonNegativeNumber,
  }),
  pixKey: optionalString,
  receiverName: optionalString,
  notes: optionalString,
  adjustments: z.array(invoiceAdjustmentSchema),
  lateFees: z.array(lateFeeRecordSchema),
  sourceInvoiceId: optionalString,
}).superRefine((value, ctx) => {
  if (value.pixKey && !value.receiverName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["receiverName"],
      message: "Informe o recebedor quando houver PIX",
    });
  }
});

export const invoiceStatusSchema = z.object({
  status: z.enum(["draft", "pending", "sent", "paid", "overdue", "canceled"]),
});

export type ClientSchema = z.infer<typeof clientSchema>;
export type CompanySettingsSchema = z.infer<typeof companySettingsSchema>;
export type InvoiceCalculationSchema = z.infer<typeof invoiceCalculationSchema>;
export type LateFeeInputSchema = z.infer<typeof lateFeeInputSchema>;

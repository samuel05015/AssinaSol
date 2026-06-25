export type TariffFlag = "green" | "yellow" | "red";
export type AdjustmentType = "fee" | "discount";
export type InterestType = "monthly" | "daily";
export type LateFeeStatus = "pending" | "included" | "canceled";
export type ProposalLayout = "modern" | "classic" | "compact";

export type ClientData = {
  id?: string;
  ucCode: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type ExtractedInvoiceData = Partial<ClientData> & {
  clientName?: string;
  referenceMonth?: string;
  dueDate?: string;
  totalConsumptionKwh?: number;
  solarConsumptionKwh?: number;
  accumulatedCreditKwh?: number;
  utilityBillValue?: number;
  publicLightingValue?: number;
  fioBValue?: number;
  tariffFlag?: TariffFlag;
  tariffFlagValue?: number;
  tariffFlagChargeValue?: number;
  missingFields?: string[];
  rawTextSample?: string;
};

export type InvoiceAdjustment = {
  id?: string;
  type: AdjustmentType;
  name: string;
  amount: number;
};

export type LateFeeRecord = {
  id?: string;
  clientId?: string;
  originalInvoiceReference: string;
  originalDueDate: string;
  paymentDate: string;
  originalAmount: number;
  finePercent: number;
  interestPercent: number;
  interestType: InterestType;
  daysLate: number;
  fineAmount: number;
  interestAmount: number;
  totalAmount: number;
  status: LateFeeStatus;
};

export type TariffValues = {
  green: number;
  yellow: number;
  red: number;
};

export type InvoiceCalculationInput = {
  client: ClientData;
  invoiceNumber?: string;
  referenceMonth: string;
  dueDate: string;
  totalConsumptionKwh?: number;
  solarConsumptionKwh: number;
  accumulatedCreditKwh?: number;
  pricePerKwh: number;
  discountPercent: number;
  fioBValue: number;
  chargeFioB: boolean;
  publicLightingValue: number;
  chargePublicLighting: boolean;
  utilityBillValue: number;
  chargeUtilityBill: boolean;
  tariffFlag: TariffFlag;
  tariffValues: TariffValues;
  pixKey?: string;
  receiverName?: string;
  notes?: string;
  adjustments: InvoiceAdjustment[];
  lateFees: LateFeeRecord[];
};

export type InvoiceCalculationResult = {
  invoiceNumber: string;
  energySubtotal: number;
  discountValue: number;
  energyTotal: number;
  totalFees: number;
  totalExtraFees: number;
  totalExtraDiscounts: number;
  totalAdjustments: number;
  totalLateFees: number;
  finalTotal: number;
  selectedTariffValue: number;
  tariffFlagCost: number;
  estimatedUtilityCost: number;
  estimatedSavings: number;
  savingsPercent: number | null;
  resolutionLines: string[];
};

export type CompanySettings = {
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyDocument: string;
  companyLogoUrl?: string;
  proposalColor: string;
  proposalLayout: ProposalLayout;
};

export type PdfBrandSettings = CompanySettings & {
  logoBytes?: Uint8Array;
  logoContentType?: string;
};

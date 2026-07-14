export const trialDays = 3;

export const planIds = ["starter", "pro", "premium"] as const;

export type PlanId = typeof planIds[number];
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export type PlanAccess = {
  canGenerate: boolean;
  canSaveClients: boolean;
  canCustomizeProposal: boolean;
  canUseInvoiceHistory: boolean;
  canUseDashboard: boolean;
  canUseLateFees: boolean;
};

export type BillingSubscription = {
  id?: string;
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  currentPeriodEndsAt?: string | null;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  paymentMethodCollected: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const planCatalog: Record<PlanId, {
  id: PlanId;
  name: string;
  price: number;
  headline: string;
  description: string;
  cta: string;
  popular?: boolean;
  features: string[];
  access: PlanAccess;
}> = {
  starter: {
    id: "starter",
    name: "Gerador",
    price: 13.90,
    headline: "Para gerar propostas sem historico",
    description: "Ideal para quem quer preencher a fatura e baixar o PDF profissional sem manter cadastro salvo.",
    cta: "Testar Gerador",
    features: [
      "Geracao da Fatura Solar em PDF",
      "Calculo de energia, descontos, taxas e bandeira",
      "PIX copia e cola e QR Code no PDF",
      "Sem historico de clientes ou faturas salvas",
    ],
    access: {
      canGenerate: true,
      canSaveClients: false,
      canCustomizeProposal: false,
      canUseInvoiceHistory: false,
      canUseDashboard: false,
      canUseLateFees: false,
    },
  },
  pro: {
    id: "pro",
    name: "Profissional",
    price: 19.90,
    headline: "Para salvar clientes e personalizar propostas",
    description: "Inclui banco de clientes, dados da empresa, logo, cores e layout da proposta.",
    cta: "Testar Profissional",
    popular: true,
    features: [
      "Tudo do plano Gerador",
      "Cadastro e listagem de clientes",
      "Personalizacao de logo, empresa, cor e layout",
      "Preserva dados do cliente ao extrair novas contas",
    ],
    access: {
      canGenerate: true,
      canSaveClients: true,
      canCustomizeProposal: true,
      canUseInvoiceHistory: false,
      canUseDashboard: false,
      canUseLateFees: false,
    },
  },
  premium: {
    id: "premium",
    name: "Completo",
    price: 29.90,
    headline: "Acesso total ao AssinaSol",
    description: "Para controlar historico, faturas, dashboard, multas, juros e recursos avancados.",
    cta: "Testar Completo",
    features: [
      "Tudo do plano Profissional",
      "Historico completo de faturas",
      "Dashboard financeiro",
      "Multa e juros de mora",
      "Recorrencia e controles avancados",
    ],
    access: {
      canGenerate: true,
      canSaveClients: true,
      canCustomizeProposal: true,
      canUseInvoiceHistory: true,
      canUseDashboard: true,
      canUseLateFees: true,
    },
  },
};

export const noPlanAccess: PlanAccess = {
  canGenerate: false,
  canSaveClients: false,
  canCustomizeProposal: false,
  canUseInvoiceHistory: false,
  canUseDashboard: false,
  canUseLateFees: false,
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && planIds.includes(value as PlanId);
}

export function getPlanAccess(subscription?: BillingSubscription | null): PlanAccess {
  if (!subscription) return noPlanAccess;
  if (!subscription.paymentMethodCollected) return noPlanAccess;
  const now = Date.now();
  const trialEndsAt = Date.parse(subscription.trialEndsAt);
  const paidEndsAt = subscription.currentPeriodEndsAt ? Date.parse(subscription.currentPeriodEndsAt) : Number.NaN;
  const trialActive = subscription.status === "trialing" && Number.isFinite(trialEndsAt) && trialEndsAt > now;
  const paidActive = subscription.status === "active" && (!Number.isFinite(paidEndsAt) || paidEndsAt > now);

  if (!trialActive && !paidActive) return noPlanAccess;
  return planCatalog[subscription.plan].access;
}

export function getSubscriptionStatus(subscription?: BillingSubscription | null): SubscriptionStatus | "none" {
  if (!subscription) return "none";
  if (subscription.status === "trialing" && Date.parse(subscription.trialEndsAt) <= Date.now()) {
    return "expired";
  }
  return subscription.status;
}

import type { PlanId, SubscriptionStatus } from "@/lib/billing/plans";

export const platformAdminEmail = "sh05015130405@gmail.com";

export function isPlatformAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === platformAdminEmail;
}

export type AdminPlatformCustomer = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  plan: PlanId | null;
  subscriptionStatus: SubscriptionStatus | "none";
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  paymentMethodCollected: boolean;
  providerCustomerId: string | null;
  complimentaryAccess: boolean;
  clientsCount: number;
  invoicesCount: number;
  generatedTotal: number;
};

export type AdminOverview = {
  stats: {
    users: number;
    activeSubscriptions: number;
    trials: number;
    attentionNeeded: number;
    projectedMrr: number;
  };
  customers: AdminPlatformCustomer[];
};

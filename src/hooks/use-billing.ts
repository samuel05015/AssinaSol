"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { noPlanAccess, planCatalog, type BillingSubscription, type PlanAccess, type PlanId } from "@/lib/billing/plans";

export const pendingPlanStorageKey = "assinasol-pending-plan";

export type BillingResponse = {
  subscription: BillingSubscription | null;
  access: PlanAccess;
  status: "none" | BillingSubscription["status"];
  error?: string;
};

const emptyBilling: BillingResponse = {
  subscription: null,
  access: noPlanAccess,
  status: "none",
};

export function useBilling(options?: { autoLoad?: boolean }) {
  const { configured, getAuthHeaders, user } = useAuth();
  const [billing, setBilling] = useState<BillingResponse>(emptyBilling);
  const [loading, setLoading] = useState(Boolean(options?.autoLoad ?? true));
  const [updating, setUpdating] = useState(false);

  const loadBilling = useCallback(async () => {
    if (configured && !user) {
      setBilling(emptyBilling);
      setLoading(false);
      return emptyBilling;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/billing/subscription", {
        headers: getAuthHeaders(),
      });
      const data = await response.json() as BillingResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Nao foi possivel carregar o plano.");
      }
      setBilling(data);
      return data;
    } catch (error) {
      const next = {
        ...emptyBilling,
        error: error instanceof Error ? error.message : "Nao foi possivel carregar o plano.",
      };
      setBilling(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [configured, getAuthHeaders, user]);

  const startTrial = useCallback(async (plan: PlanId) => {
    setUpdating(true);
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json() as BillingResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nao foi possivel iniciar o teste.");
      }
      setBilling(data);
      return data;
    } finally {
      setUpdating(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (options?.autoLoad === false) return;

    const timer = window.setTimeout(() => {
      void loadBilling();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadBilling, options?.autoLoad]);

  return {
    billing,
    loading,
    updating,
    loadBilling,
    startTrial,
    plans: Object.values(planCatalog),
  };
}

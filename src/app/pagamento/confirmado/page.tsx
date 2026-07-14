import { PaymentConfirmation } from "@/components/billing/payment-confirmation";

export default async function PagamentoConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  return <PaymentConfirmation sessionId={params.session_id} />;
}

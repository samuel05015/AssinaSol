import { ProtectedShell } from "@/components/auth/protected-shell";
import { UploadInvoiceFlow } from "@/components/solar/upload-invoice-flow";

export default function CarregarFaturaPage() {
  return (
    <ProtectedShell>
      <UploadInvoiceFlow />
    </ProtectedShell>
  );
}

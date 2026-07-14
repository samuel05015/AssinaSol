import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { ProtectedShell } from "@/components/auth/protected-shell";

export default function AdminPage() {
  return (
    <ProtectedShell>
      <AdminDashboard />
    </ProtectedShell>
  );
}

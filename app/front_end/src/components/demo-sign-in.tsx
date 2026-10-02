// One-click entry for demo mode. Only shown when the app runs on mock data.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage, USE_MOCKS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function DemoSignInButton({ size = "default", className }: { size?: "default" | "lg"; className?: string }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!USE_MOCKS) return null;

  async function enter() {
    setBusy(true);
    try {
      const res = await api.demoLogin();
      signIn(res.access_token, res.user);
      navigate({ to: "/jobs/new", replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <Button type="button" variant="outline" size={size} {...(className ? { className } : {})} onClick={enter} disabled={busy}>
      {busy ? "Opening demo..." : "Try the demo"}
    </Button>
  );
}

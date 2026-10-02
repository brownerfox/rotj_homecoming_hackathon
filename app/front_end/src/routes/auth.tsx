import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { DemoSignInButton } from "@/components/demo-sign-in";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorState } from "@/components/app-ui";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Calibrate" },
      { name: "description", content: "Sign in to Calibrate to set up interviews and review candidate analysis." },
      { property: "og:title", content: "Sign in — Calibrate" },
      { property: "og:description", content: "Access your hiring team's interviews and candidate analysis." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", company_name: "", role: "hiring_manager" as Role });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password || (mode === "signup" && (!form.name || !form.company_name))) {
      setError("Please complete all required fields.");
      return;
    }
    if (mode === "signup" && form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const res = mode === "signin"
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      signIn(res.access_token, res.user);
      navigate({ to: "/jobs/new", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="flex justify-center pb-2">
              <BrandLogo to="/" imgClassName="h-14" />
            </div>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as typeof mode); setError(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
            <CardTitle className="pt-4">{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
            <CardDescription>
              {mode === "signin" ? "Sign in to continue." : "Choose your role to tailor your workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field label="Full name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
                  <Field label="Company"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <RadioGroup value={form.role} onValueChange={(v) => set("role", v)} className="grid grid-cols-2 gap-2">
                      {[["hiring_manager", "Hiring Manager", "Defines what the role needs"], ["recruiter", "Recruiter", "Runs the interview process"]].map(([v, l, d]) => (
                        <Label key={v} htmlFor={v} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary has-[:checked]:bg-accent">
                          <RadioGroupItem value={v!} id={v} className="mt-0.5" />
                          <span><span className="block font-medium">{l}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              )}
              <Field label="Email"><Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Password">
                <Input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={form.password} onChange={(e) => set("password", e.target.value)} />
              </Field>
              {error && <ErrorState message={error} />}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <DemoSignInButton className="mt-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PhoneCall, UserRoundSearch } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { createExpertFilingRequest, getLatestExpertFilingRequest } from "@/lib/expert-filing/api";
import { STATUS_LABELS } from "@/lib/expert-filing/types";
import type { ExpertFilingPlan } from "@/lib/expert-filing/types";

function PlanCard({
  title,
  price,
  description,
  bullets,
  action,
  highlighted,
}: {
  title: string;
  price: string;
  description: string;
  bullets: string[];
  action?: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col gap-3 bg-card border-line p-4", highlighted && "ring-2 ring-accent")}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-2xl font-semibold text-foreground">{price}</p>
      </div>
      <p className="text-sm text-muted">{description}</p>
      <ul className="flex flex-col gap-1 text-sm text-foreground">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {bullet}
          </li>
        ))}
      </ul>
      {action}
    </Card>
  );
}

function RequestForm({
  plan,
  price,
  onCancel,
  onSubmit,
  isPending,
  error,
}: {
  plan: ExpertFilingPlan;
  price: number;
  onCancel: () => void;
  onSubmit: (phone: string, preferredTime: string) => void;
  isPending: boolean;
  error?: string;
}) {
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(phone, preferredTime);
      }}
    >
      <Input
        label="Phone number"
        type="tel"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="10-digit mobile number"
      />
      <Input
        label="Preferred time (optional)"
        value={preferredTime}
        onChange={(event) => setPreferredTime(event.target.value)}
        placeholder="e.g. Weekday evenings after 7pm"
      />
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || phone.trim().length < 10}>
          {isPending ? "Sending…" : `Request ${plan === "assisted" ? "Assisted" : "Premium"} — ₹${price}/yr`}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ExpertFilingPlans({ ay }: { ay: string }) {
  const queryClient = useQueryClient();
  const [activePlan, setActivePlan] = useState<ExpertFilingPlan | null>(null);
  const [expanded, setExpanded] = useState(false);

  const latestQuery = useQuery({
    queryKey: ["expert-filing-latest", ay],
    queryFn: () => getLatestExpertFilingRequest(ay),
    enabled: !!ay,
  });

  const createMutation = useMutation({
    mutationFn: createExpertFilingRequest,
    onSuccess: (request) => {
      queryClient.setQueryData(["expert-filing-latest", ay], request);
      setActivePlan(null);
    },
  });

  if (latestQuery.isPending) {
    return null;
  }

  if (latestQuery.data) {
    const request = latestQuery.data;
    return (
      <Card className="flex items-start gap-3 bg-card border-line p-4">
        <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            {request.plan === "assisted" ? "Assisted" : "Premium"} plan requested
            <Badge variant="success">{STATUS_LABELS[request.status]}</Badge>
          </p>
          <p className="text-sm text-muted">
            {request.calls_included > 0
              ? `${request.calls_included} CA call${request.calls_included === 1 ? "" : "s"} included. `
              : ""}
            We&apos;ll call {request.contact_phone} to get you set up
            {request.preferred_time ? ` (${request.preferred_time})` : ""}.
          </p>
        </div>
      </Card>
    );
  }

  if (!expanded) {
    return (
      <Card className="flex items-start gap-3 bg-card border-line p-4">
        <UserRoundSearch className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">Want MoneyMitra to take it from here?</p>
            <p className="text-sm text-muted">See the paid plans — automation, or a CA on the phone.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setExpanded(true)}>
            See paid plans
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-line">
      <h3 className="text-h2 mb-2">Choose how you want to file</h3>
      <p className="mb-4 text-sm text-muted">
        File it yourself with the download above, let MoneyMitra automate it, or bring in a CA.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <PlanCard
          title="Free"
          price="₹0"
          description="Self-file using the download above."
          bullets={["JSON + PDF download", "Upload it yourself on incometax.gov.in"]}
        />
        <PlanCard
          title="Assisted"
          price="₹499/yr"
          description="MoneyMitra does it for you."
          bullets={[
            "Everything in Free",
            "Auto-fill from your documents",
            "e-filing from MoneyMitra — no download or re-upload",
            "Personalised FD, RD, fund and ETF options for you",
            "Tax planning: deduction room and deadline alerts",
          ]}
          action={
            activePlan === "assisted" ? (
              <RequestForm
                plan="assisted"
                price={499}
                isPending={createMutation.isPending}
                error={createMutation.isError ? createMutation.error.message : undefined}
                onCancel={() => setActivePlan(null)}
                onSubmit={(phone, preferredTime) =>
                  createMutation.mutate({
                    assessment_year: ay,
                    plan: "assisted",
                    contact_phone: phone,
                    preferred_time: preferredTime || null,
                  })
                }
              />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setActivePlan("assisted")}>
                Get Assisted
              </Button>
            )
          }
        />
        <PlanCard
          title="Premium"
          price="₹1,999/yr"
          highlighted
          description="A CA in your corner, all year."
          bullets={[
            "Everything in Assisted",
            "CA reviews your return before it's filed — 1 call",
            "Our best pick — the one FD, RD, fund or ETF (and the amount) for you",
            "Year-round: a mid-year tax check plus priority chat with the CA",
            "Notices covered — if the tax department follows up, the CA helps you reply",
          ]}
          action={
            activePlan === "premium" ? (
              <RequestForm
                plan="premium"
                price={1999}
                isPending={createMutation.isPending}
                error={createMutation.isError ? createMutation.error.message : undefined}
                onCancel={() => setActivePlan(null)}
                onSubmit={(phone, preferredTime) =>
                  createMutation.mutate({
                    assessment_year: ay,
                    plan: "premium",
                    contact_phone: phone,
                    preferred_time: preferredTime || null,
                  })
                }
              />
            ) : (
              <Button size="sm" onClick={() => setActivePlan("premium")}>
                Request a CA call
              </Button>
            )
          }
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        This only records your request — our team will call you to confirm and take payment separately.
      </p>
    </Card>
  );
}

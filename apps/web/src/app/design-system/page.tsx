"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardDark,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  MetricCard,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  Tooltip,
  TransactionRow,
} from "@/components/ui";
import { Inbox } from "lucide-react";

const SWATCHES: Array<{ name: string; className: string }> = [
  { name: "background", className: "bg-background" },
  { name: "surface", className: "bg-surface border border-border" },
  { name: "surface-muted", className: "bg-surface-muted" },
  { name: "primary", className: "bg-primary" },
  { name: "accent", className: "bg-accent" },
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "error", className: "bg-error" },
];

export default function DesignSystemPage() {
  const [period, setPeriod] = useState<"1W" | "1M" | "1Y" | "All">("1W");
  const [roundUp, setRoundUp] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background p-6 md:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <Logo height={36} />
          <ThemeToggle />
        </header>

        <section>
          <h2 className="text-h1 mb-4">Colors</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-2">
                <div className={`h-16 rounded-md ${swatch.className}`} />
                <span className="text-sm text-muted">{swatch.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Typography</h2>
          <Card className="flex flex-col gap-4">
            <p className="text-display">Grow what you earn</p>
            <p className="text-h1">Your spending this month</p>
            <p className="text-h2">Recent transactions</p>
            <p className="text-body">Transfers arrive within one business day.</p>
            <p className="text-caption text-muted">Updated 2 minutes ago</p>
            <p className="text-amount-lg">₹24,806.52</p>
            <p className="text-amount-sm">−₹42.10 · +₹1,200.00</p>
          </Card>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-8">
            <Card className="flex items-center gap-3">
              <Button variant="primary">Send money</Button>
              <Button variant="secondary">Request</Button>
              <Button variant="ghost">Cancel</Button>
            </Card>
            <CardDark className="flex items-center gap-3">
              <Button variant="primary">Add funds</Button>
              <Button variant="secondary">Transfer</Button>
            </CardDark>
          </div>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Inputs &amp; select</h2>
          <Card className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" defaultValue="₹ 1,250.00" hint="Available: ₹8,402.19" />
            <Input label="Recipient" placeholder="Name, email or phone" />
            <Select label="Document type" defaultValue="payslip">
              <option value="payslip">Payslip</option>
              <option value="form16">Form 16</option>
              <option value="other">Other</option>
            </Select>
            <Input label="With error" defaultValue="12abc" error="Enter a valid amount" />
          </Card>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Badges</h2>
          <Card className="flex flex-wrap gap-3">
            <Badge variant="success">Completed</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="error">Failed</Badge>
            <Badge variant="neutral">Scheduled</Badge>
            <Badge variant="accent">New</Badge>
          </Card>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Segmented control &amp; toggle</h2>
          <Card className="flex flex-wrap items-center gap-8">
            <SegmentedControl
              options={["1W", "1M", "1Y", "All"] as const}
              value={period}
              onChange={setPeriod}
            />
            <div className="flex items-center gap-3">
              <span className="text-body">Round-up savings</span>
              <Switch checked={roundUp} onCheckedChange={setRoundUp} label="Round-up savings" />
            </div>
            <Tooltip label="This is a tooltip">
              <Button variant="secondary" size="sm">
                Hover me
              </Button>
            </Tooltip>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
          </Card>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Avatar &amp; transaction list</h2>
          <Card>
            <div className="mb-4 flex gap-3">
              <Avatar initial="S" />
              <Avatar initial="W" />
              <Avatar initial="N" />
            </div>
            <div className="divide-y divide-border">
              <TransactionRow initial="S" title="Salary · Acme Inc" subtitle="Today · Deposit" amount={4200} />
              <TransactionRow initial="W" title="Whole Foods" subtitle="Yesterday · Groceries" amount={-86.4} />
              <TransactionRow initial="N" title="Netflix" subtitle="Sep 24 · Subscription" amount={-15.49} />
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-h1 mb-4">Metric card</h2>
          <MetricCard
            label="Total balance"
            amount={24806.52}
            changeLabel="+4.2%"
            bars={[0.3, 0.5, 0.35, 0.6, 0.45, 0.7, 0.5, 0.65, 0.55, 0.8, 0.6, 1]}
          />
        </section>

        <section>
          <h2 className="text-h1 mb-4">Loading, empty &amp; error states</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="flex flex-col gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </Card>
            <EmptyState icon={Inbox} title="No transactions yet" description="They'll show up here once you connect an account." />
            <ErrorState title="Couldn't load data" description="Something went wrong. Try again." />
          </div>
        </section>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Example dialog">
          <p className="text-body text-muted">
            This is a native &lt;dialog&gt;-based modal styled with design system tokens.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  );
}

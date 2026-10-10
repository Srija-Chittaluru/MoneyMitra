const BANKS = [
  { name: "HDFC", src: "/auth/banks/hdfc.png", left: "50%", top: "0%" },
  { name: "ICICI", src: "/auth/banks/icici.png", left: "93.3%", top: "25%" },
  { name: "SBI", src: "/auth/banks/sbi.png", left: "93.3%", top: "75%" },
  { name: "Axis", src: "/auth/banks/axis.png", left: "50%", top: "100%" },
  { name: "Kotak", src: "/auth/banks/kotak.png", left: "6.7%", top: "75%" },
  { name: "Yes Bank", src: "/auth/banks/yes.png", left: "6.7%", top: "25%" },
];

const DOC_CHIPS = [
  { label: "Form 16", left: "93.3%", top: "25%", tone: "mint" as const },
  { label: "AIS", left: "50%", top: "100%", tone: "blue" as const },
  { label: "26AS", left: "6.7%", top: "25%", tone: "mint" as const },
];

const INNER_CHIPS = [
  { label: "Payslip", left: "96.98%", top: "67.1%", tone: "blue" as const },
  { label: "CAS", left: "3.02%", top: "32.9%", tone: "mint" as const },
];

/** Three concentric rings of real-looking data sources, orbiting a central MoneyMitra mark. Purely decorative. */
export function OrbitSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-square h-full max-h-[380px] max-w-full">
        <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgba(71,114,255,0.22),transparent)]" />

        <div
          className="mm-orbit-ring absolute inset-0 rounded-full border border-link/25"
          style={{ animationDuration: "90s" }}
        >
          {BANKS.map((bank) => (
            <div
              key={bank.name}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: bank.left, top: bank.top }}
            >
              <div className="mm-orbit-counter" style={{ animationDuration: "90s" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white p-3 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative logo, not worth next/image's overhead here */}
                  <img src={bank.src} alt={bank.name} className="h-full w-full object-contain" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mm-orbit-ring mm-orbit-ring--reverse absolute inset-[16%] rounded-full border border-link/25"
          style={{ animationDuration: "70s" }}
        >
          {DOC_CHIPS.map((chip) => (
            <div
              key={chip.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: chip.left, top: chip.top }}
            >
              <div className="mm-orbit-counter mm-orbit-counter--normal" style={{ animationDuration: "70s" }}>
                <span className="flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-sm font-medium text-foreground shadow-md">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: chip.tone === "mint" ? "var(--accent-solid)" : "#4772FF" }}
                  />
                  {chip.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mm-orbit-ring absolute inset-[31%] rounded-full border border-link/25" style={{ animationDuration: "50s" }}>
          {INNER_CHIPS.map((chip) => (
            <div
              key={chip.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: chip.left, top: chip.top }}
            >
              <div className="mm-orbit-counter" style={{ animationDuration: "50s" }}>
                <span className="flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-3.5 text-sm font-medium text-foreground shadow-md">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: chip.tone === "mint" ? "var(--accent-solid)" : "#4772FF" }}
                  />
                  {chip.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card shadow-[0_0_0_12px_rgba(71,114,255,0.08),0_30px_70px_-24px_rgba(11,15,20,0.25)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/moneymitra-mark.png" alt="MoneyMitra" className="h-12 w-auto" />
        </div>
      </div>

      <style>{`
        @keyframes mm-orbit-spin { to { transform: rotate(360deg); } }
        .mm-orbit-ring { animation-name: mm-orbit-spin; animation-timing-function: linear; animation-iteration-count: infinite; }
        .mm-orbit-ring--reverse { animation-direction: reverse; }
        .mm-orbit-counter { animation-name: mm-orbit-spin; animation-timing-function: linear; animation-iteration-count: infinite; animation-direction: reverse; }
        .mm-orbit-counter--normal { animation-direction: normal; }
      `}</style>
    </div>
  );
}

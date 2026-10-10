import { redirect } from "next/navigation";

// FD Comparison now lives under Recommendations → Fixed Deposits; `#fd` opens that
// tab, so old links and bookmarks keep landing on the comparison.
export default function FdComparisonRedirect() {
  redirect("/recommendations#fd");
}

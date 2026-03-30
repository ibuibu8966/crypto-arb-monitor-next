"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/skeletons";

export const DynamicAllCharts = dynamic(
  () =>
    import("@/features/charts/components/all-charts").then((m) => ({
      default: m.AllCharts,
    })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

export const DynamicSymbolDetail = dynamic(
  () =>
    import("@/features/symbol/components/symbol-detail").then((m) => ({
      default: m.SymbolDetail,
    })),
  { loading: () => <ChartSkeleton />, ssr: false }
);

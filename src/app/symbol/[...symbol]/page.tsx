import { SymbolDetail } from "@/features/symbol/components/symbol-detail";

type Props = {
  params: Promise<{ symbol: string[] }>;
};

export default async function SymbolPage({ params }: Props) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol.join("/"));
  return <SymbolDetail symbol={decoded} />;
}

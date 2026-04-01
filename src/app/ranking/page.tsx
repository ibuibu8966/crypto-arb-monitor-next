import { RankingTable } from "./components/ranking-table";

export default function RankingPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-100">スコアランキング</h1>
        <p className="text-xs text-gray-500 mt-1">
          複合スコア（到達回数 × リバージョン確率 × コスト比率 ÷ ハーフライフ × log(出来高+1)）順
        </p>
      </div>
      <RankingTable />
    </div>
  );
}

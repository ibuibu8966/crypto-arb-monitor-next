export function ChartSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-gray-900 border border-gray-800 rounded-lg p-3 animate-pulse"
        >
          <div className="h-4 w-48 bg-gray-800 rounded mb-3" />
          <div className="h-[200px] bg-gray-800/50 rounded" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800 animate-pulse">
      <div className="bg-gray-800/50 h-10 w-full" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 px-3 py-2 border-t border-gray-800/50">
          {[...Array(6)].map((_, j) => (
            <div key={j} className="h-4 bg-gray-800 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-20" />
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg h-[200px]" />
      <TableSkeleton />
    </div>
  );
}

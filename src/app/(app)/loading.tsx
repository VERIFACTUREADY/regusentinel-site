export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border">
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="h-5 bg-gray-200 rounded w-40" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-6 py-4 border-b flex gap-4">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded flex-1" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        {/* Modern spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center mb-4">
          <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
          <div className="absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-blue-900 font-mono font-bold tracking-widest text-xs uppercase animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}

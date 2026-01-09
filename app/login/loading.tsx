export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
        <div className="h-4 w-48 bg-slate-200 rounded"></div>
      </div>
    </div>
  )
}

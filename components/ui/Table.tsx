export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

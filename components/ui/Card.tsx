export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-4 border border-borderSubtle">
      {children}
    </div>
  )
}

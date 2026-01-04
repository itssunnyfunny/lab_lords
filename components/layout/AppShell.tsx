export function AppShell({ sidebar, children }: any) {
  return (
    <div className="flex min-h-screen bg-app">
      <aside className="w-16 bg-surface border-r border-borderSubtle">
        {sidebar}
      </aside>

      <main className="flex-1 p-6 space-y-6">
        {children}
      </main>
    </div>
  )
}

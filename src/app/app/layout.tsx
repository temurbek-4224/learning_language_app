export default function StudentMiniAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <main className="mx-auto min-h-screen w-full max-w-md px-4 py-6">
        {children}
      </main>
    </div>
  );
}

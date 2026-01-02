export default function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 lg:px-20 w-full max-w-7xl mx-auto">
      {children}
    </div>
  );
} 
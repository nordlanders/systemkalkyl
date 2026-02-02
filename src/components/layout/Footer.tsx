import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t bg-card/50 mt-auto">
      <div className="container px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
              <div className="relative p-2 rounded-lg bg-gradient-to-br from-primary via-primary/80 to-accent border border-primary/30 shadow-lg shadow-primary/20">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <span className="font-medium tracking-wide">
              <span className="text-foreground">DigIT</span>
              <span className="text-primary ml-1">Black Op's</span>
            </span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <span className="text-xs sm:text-sm">
            Designed and Engineered by DigIT Black Op's 2026
          </span>
        </div>
      </div>
    </footer>
  );
}

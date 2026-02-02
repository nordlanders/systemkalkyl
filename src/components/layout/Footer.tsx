import { Zap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t bg-card/50 mt-auto">
      <div className="container px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
              <div className="relative p-1.5 rounded-md bg-gradient-to-br from-primary via-primary/80 to-accent border border-primary/30 shadow-md shadow-primary/20">
                <Zap className="h-3 w-3 text-primary-foreground" />
              </div>
            </div>
            <span className="font-medium tracking-wide text-xs">
              <span className="text-foreground">DigIT</span>
              <span className="text-primary ml-1">Black Op's</span>
            </span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <span className="text-[10px] sm:text-xs">
            Designed and Engineered by DigIT Black Op's 2026
          </span>
        </div>
      </div>
    </footer>
  );
}

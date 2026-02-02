import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import ChangePasswordDialog from '@/components/auth/ChangePasswordDialog';
import Footer from '@/components/layout/Footer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calculator, 
  Settings, 
  Users, 
  History, 
  LogOut,
  Menu,
  X,
  BarChart3,
  Home,
  ChevronDown,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

const mainNavItems = [
  { href: '/', icon: Home, label: 'Start', adminOnly: false },
  { href: '/calculator', icon: Calculator, label: 'Kalkyler', adminOnly: false },
  { href: '/analytics', icon: BarChart3, label: 'Analys', adminOnly: true },
  { href: '/history', icon: History, label: 'Historik', adminOnly: false },
];

const adminNavItems = [
  { href: '/pricing', icon: Settings, label: 'Priskonfiguration' },
  { href: '/users', icon: Users, label: 'Användare' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-primary">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg hidden sm:block">Tjänstekalkyl</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {mainNavItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link key={item.href} to={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'gap-2',
                        isActive && 'bg-primary/10 text-primary hover:bg-primary/15'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            
            {/* Administration dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={adminNavItems.some(item => location.pathname === item.href) ? 'secondary' : 'ghost'}
                  className={cn(
                    'gap-2',
                    adminNavItems.some(item => location.pathname === item.href) && 'bg-primary/10 text-primary hover:bg-primary/15'
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Administration
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {adminNavItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link to={item.href} className="flex items-center gap-2 cursor-pointer">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user?.email}</span>
              {isAdmin && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                  Admin
                </span>
              )}
            </div>
            <ChangePasswordDialog />
            <Button variant="ghost" size="icon" onClick={signOut} title="Logga ut">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 z-40 bg-background/95 backdrop-blur">
          <nav className="flex flex-col p-4 gap-2">
            {mainNavItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3',
                        isActive && 'bg-primary/10 text-primary'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            
            {/* Administration section for mobile */}
            <div className="pt-2 mt-2 border-t">
              <span className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-3 w-3" />
                Administration
              </span>
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3',
                        isActive && 'bg-primary/10 text-primary'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-4 py-8 flex-1">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

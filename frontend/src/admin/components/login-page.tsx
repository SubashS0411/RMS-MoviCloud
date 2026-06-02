import { useState } from 'react';
import { useAuth, UserRole } from '@/admin/utils/auth-context';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Alert, AlertDescription } from '@/admin/components/ui/alert';
import { LogIn, Eye, EyeOff, ChefHat, UserCog, CreditCard, Users, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="h-5 w-5" />,
  manager: <UserCog className="h-5 w-5" />,
  chef: <ChefHat className="h-5 w-5" />,
  waiter: <Users className="h-5 w-5" />,
  cashier: <CreditCard className="h-5 w-5" />,
};

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful!');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-login-module flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Form */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-3 pb-2 text-center">
            <div className="flex justify-center">
              <img src="/favicon.png" alt="logo" className="h-11 w-auto max-w-[48px] rounded-lg object-contain" />
            </div>
            <div>
              {/* Mobile: short brand name */}
              <CardTitle className="text-3xl font-bold tracking-tight sm:hidden">RMS</CardTitle>
              {/* Desktop: full name */}
              <CardTitle className="hidden sm:block text-2xl">Urban Bites</CardTitle>
              <CardDescription className="mt-1.5">Sign in with your staff credentials</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                <Lock className="h-4 w-4" />
                <span>Role-based access control</span>
              </div>
              <div className="flex justify-center gap-4 flex-wrap">
                {(['admin', 'manager', 'chef', 'waiter', 'cashier'] as UserRole[]).map((role) => (
                  <div key={role} className="flex flex-col items-center gap-1 text-muted-foreground">
                    <div className="p-2 rounded-lg bg-muted">
                      {ROLE_ICONS[role]}
                    </div>
                    <span className="text-xs capitalize">{role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Contact admin if you don't have an account</p>
              <p className="mt-2 text-xs">Powered by Movicloud Labs</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

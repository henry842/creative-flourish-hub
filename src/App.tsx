import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { OnboardingModal } from "@/components/OnboardingModal";
import { SessionGuard } from "@/components/SessionGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageSkeleton } from "@/components/PageSkeleton";

// Lazy loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Index"));
const Chat = lazy(() => import("./pages/Chat"));
const Sentiment = lazy(() => import("./pages/Sentiment"));
const Compare = lazy(() => import("./pages/Compare"));
const Ranking = lazy(() => import("./pages/Ranking"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Profile = lazy(() => import("./pages/Profile"));
const Assets = lazy(() => import("./pages/Assets"));
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const Briefing = lazy(() => import("./pages/Briefing"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="wordmark text-lg text-foreground">FinSight</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/landing" replace />;
  return <AppLayout><SessionGuard /><OnboardingModal />{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
              <Routes>
                <Route path="/landing" element={<LazyPage><Landing /></LazyPage>} />
                <Route path="/auth" element={<PublicRoute><LazyPage><Auth /></LazyPage></PublicRoute>} />
                <Route path="/reset-password" element={<LazyPage><ResetPassword /></LazyPage>} />
                <Route path="/" element={<ProtectedRoute><LazyPage><Dashboard /></LazyPage></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><Navigate to="/assets" replace /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><LazyPage><Chat /></LazyPage></ProtectedRoute>} />
                <Route path="/sentiment" element={<ProtectedRoute><LazyPage><Sentiment /></LazyPage></ProtectedRoute>} />
                <Route path="/compare" element={<ProtectedRoute><LazyPage><Compare /></LazyPage></ProtectedRoute>} />
                <Route path="/ranking" element={<ProtectedRoute><LazyPage><Ranking /></LazyPage></ProtectedRoute>} />
                <Route path="/assets" element={<ProtectedRoute><LazyPage><Assets /></LazyPage></ProtectedRoute>} />
                <Route path="/assets/:id" element={<ProtectedRoute><LazyPage><AssetDetail /></LazyPage></ProtectedRoute>} />
                <Route path="/briefing" element={<ProtectedRoute><LazyPage><Briefing /></LazyPage></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><LazyPage><Profile /></LazyPage></ProtectedRoute>} />
                <Route path="/pricing" element={<LazyPage><Pricing /></LazyPage>} />
                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

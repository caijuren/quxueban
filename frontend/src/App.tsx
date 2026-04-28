import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { PageTransition } from "@/components/PageTransition";
import { AuthProvider } from "@/hooks/useAuth";
import { SelectedChildProvider } from "@/contexts/SelectedChildContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// DebtTracker 已移除

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ParentLayout = lazy(() => import("./components/parent/Layout"));
const ParentDashboard = lazy(() => import("./pages/parent/Dashboard"));
const GrowthDashboard = lazy(() => import("./pages/parent/GrowthDashboard"));
const AbilityModel = lazy(() => import("./pages/parent/AbilityModel"));
const ParentGoals = lazy(() => import("./pages/parent/Goals"));
const ParentTasks = lazy(() => import("./pages/parent/Tasks"));
const ParentTaskDetail = lazy(() => import("./pages/parent/TaskDetail"));
const ParentTaskTemplates = lazy(() => import("./pages/parent/TaskTemplates"));
const ParentPlans = lazy(() => import("./pages/parent/Plans"));
const ParentLibrary = lazy(() => import("./pages/parent/Library"));
const BookDetail = lazy(() => import("./pages/parent/BookDetail"));
const BookInsights = lazy(() => import("./pages/parent/BookInsights"));
const ParentAchievements = lazy(() => import("./pages/parent/Achievements"));
const ParentStatistics = lazy(() => import("./pages/parent/Statistics"));
const ReportsPage = lazy(() => import("./pages/parent/Reports"));
const SettingsPage = lazy(() => import("./pages/parent/Settings"));
const HelpCenter = lazy(() => import("./pages/parent/HelpCenter"));

function RouteLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        正在加载...
      </div>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      {children}
    </Suspense>
  );
}

function page(node: ReactNode, transition: "slide-up" | "fade" = "slide-up") {
  return (
    <LazyPage>
      <PageTransition transition={transition}>{node}</PageTransition>
    </LazyPage>
  );
}


/**
 * Configure TanStack Query client with optimized defaults
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 1 minute
      staleTime: 60 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect by default
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <SelectedChildProvider>
              <ErrorBoundary>
              <AnimatedRoutes>
                <Route path="/" data-genie-title="Home Page" data-genie-key="Home" element={page(<Index />)} />
                <Route path="/login" data-genie-title="Login" data-genie-key="Login" element={page(<Login />, "fade")} />
                <Route path="/register" data-genie-title="Register" data-genie-key="Register" element={page(<Register />, "fade")} />
                {/* Debt route removed */}
                <Route path="/parent" element={<LazyPage><ParentLayout /></LazyPage>}>
                  <Route index data-genie-title="Parent Dashboard" data-genie-key="ParentDashboard" element={page(<ParentDashboard />)} />
                  <Route path="growth-dashboard" data-genie-title="Growth Dashboard" data-genie-key="GrowthDashboard" element={page(<GrowthDashboard />)} />
                  <Route path="ability-model" data-genie-title="Ability Model" data-genie-key="AbilityModel" element={page(<AbilityModel />)} />
                  <Route path="goals" data-genie-title="Goals" data-genie-key="ParentGoals" element={page(<ParentGoals />)} />
                  <Route path="tasks" data-genie-title="Tasks" data-genie-key="ParentTasks" element={page(<ParentTasks />)} />
                  <Route path="tasks/:id" data-genie-title="Task Detail" data-genie-key="ParentTaskDetail" element={page(<ParentTaskDetail />)} />
                  <Route path="task-templates" data-genie-title="Task Templates" data-genie-key="ParentTaskTemplates" element={page(<ParentTaskTemplates />)} />
                  <Route path="plans" data-genie-title="Plans" data-genie-key="ParentPlans" element={page(<ParentPlans />)} />
                  <Route path="library" data-genie-title="Library" data-genie-key="ParentLibrary" element={page(<ParentLibrary />)} />
                  <Route path="library/:id" data-genie-title="Book Detail" data-genie-key="BookDetail" element={page(<BookDetail />)} />
                  <Route path="library/:id/insights" data-genie-title="AI Reading Insights" data-genie-key="BookInsights" element={page(<BookInsights />)} />
                  <Route path="reading" element={<Navigate to="/parent/library" replace />} />
                  <Route path="achievements" data-genie-title="Achievements" data-genie-key="ParentAchievements" element={page(<ParentAchievements />)} />
                  <Route path="children" data-genie-title="Children" data-genie-key="ParentChildren" element={<Navigate to="/parent/settings/children" replace />} />
                  <Route path="statistics" data-genie-title="Statistics" data-genie-key="ParentStatistics" element={page(<ParentStatistics />)} />
                  <Route path="reports" data-genie-title="Reports" data-genie-key="ReportsPage" element={page(<ReportsPage />)} />
                  <Route path="help" data-genie-title="Help Center" data-genie-key="HelpCenter" element={page(<HelpCenter />)} />
                  <Route path="settings/*" data-genie-title="Settings" data-genie-key="ParentSettings" element={page(<SettingsPage />)} />
                </Route>

                <Route path="*" data-genie-key="NotFound" data-genie-title="Not Found" element={page(<NotFound />, "fade")} />
              </AnimatedRoutes>
              </ErrorBoundary>
            </SelectedChildProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

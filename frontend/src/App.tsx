import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { PageTransition } from "@/components/PageTransition";
import { AuthProvider } from "@/hooks/useAuth";
import { SelectedChildProvider } from "@/contexts/SelectedChildContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ChildLogin from "./pages/ChildLogin";
import Register from "./pages/Register";
import ChildLayout from "./components/child/Layout";
import ChildDashboard from "./pages/child/Dashboard";
import ChildTasks from "./pages/child/Tasks";
import ChildWeeklyPlan from "./pages/child/WeeklyPlanPage";
import ChildLibrary from "./pages/child/Library";
import ChildAchievements from "./pages/child/Achievements";
import ChildReports from "./pages/child/Reports";
import ParentLayout from "./components/parent/Layout";
import ParentDashboard from "./pages/parent/Dashboard";
import ParentTasks from "./pages/parent/Tasks";
import ParentTaskTemplates from "./pages/parent/TaskTemplates";
import ParentPlans from "./pages/parent/Plans";
import ParentChildren from "./pages/parent/Children";
import ParentLibrary from "./pages/parent/Library";
import BookDetail from "./pages/parent/BookDetail";
import BookInsights from "./pages/parent/BookInsights";
import ParentReading from "./pages/parent/Reading";
import ParentAchievements from "./pages/parent/Achievements";
import ParentStatistics from "./pages/parent/Statistics";
import ParentSettings from "./pages/parent/Settings";

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
                {/* Public Routes */}
                <Route path="/" data-genie-title="Home Page" data-genie-key="Home" element={<PageTransition transition="slide-up"><Index /></PageTransition>} />
                <Route path="/login" data-genie-title="Login" data-genie-key="Login" element={<PageTransition transition="fade"><Login /></PageTransition>} />
                <Route path="/child-login" data-genie-title="Child Login" data-genie-key="ChildLogin" element={<PageTransition transition="fade"><ChildLogin /></PageTransition>} />
                <Route path="/register" data-genie-title="Register" data-genie-key="Register" element={<PageTransition transition="fade"><Register /></PageTransition>} />

                {/* Child Routes with Layout */}
                <Route path="/child" element={<ChildLayout />}>
                  <Route index data-genie-title="Child Dashboard" data-genie-key="ChildDashboard" element={<PageTransition transition="slide-up"><ChildDashboard /></PageTransition>} />
                  <Route path="tasks" data-genie-title="Tasks" data-genie-key="ChildTasks" element={<PageTransition transition="slide-up"><ChildTasks /></PageTransition>} />
                  <Route path="weekly-plan" data-genie-title="Weekly Plan" data-genie-key="ChildWeeklyPlan" element={<PageTransition transition="slide-up"><ChildWeeklyPlan /></PageTransition>} />
                  <Route path="library" data-genie-title="Library" data-genie-key="Library" element={<PageTransition transition="slide-up"><ChildLibrary /></PageTransition>} />
                  <Route path="achievements" data-genie-title="Achievements" data-genie-key="Achievements" element={<PageTransition transition="slide-up"><ChildAchievements /></PageTransition>} />
                  <Route path="reports" data-genie-title="Reports" data-genie-key="Reports" element={<PageTransition transition="slide-up"><ChildReports /></PageTransition>} />
                </Route>

                {/* Parent Routes with Layout */}
                <Route path="/parent" element={<ParentLayout />}>
                  <Route index data-genie-title="Parent Dashboard" data-genie-key="ParentDashboard" element={<PageTransition transition="slide-up"><ParentDashboard /></PageTransition>} />
                  <Route path="tasks" data-genie-title="Tasks" data-genie-key="ParentTasks" element={<PageTransition transition="slide-up"><ParentTasks /></PageTransition>} />
                  <Route path="task-templates" data-genie-title="Task Templates" data-genie-key="ParentTaskTemplates" element={<PageTransition transition="slide-up"><ParentTaskTemplates /></PageTransition>} />
                  <Route path="plans" data-genie-title="Plans" data-genie-key="ParentPlans" element={<PageTransition transition="slide-up"><ParentPlans /></PageTransition>} />
                  <Route path="library" data-genie-title="Library" data-genie-key="ParentLibrary" element={<PageTransition transition="slide-up"><ParentLibrary /></PageTransition>} />
                  <Route path="library/:id" data-genie-title="Book Detail" data-genie-key="BookDetail" element={<PageTransition transition="slide-up"><BookDetail /></PageTransition>} />
                  <Route path="library/:id/insights" data-genie-title="AI Reading Insights" data-genie-key="BookInsights" element={<PageTransition transition="slide-up"><BookInsights /></PageTransition>} />
                  <Route path="reading" data-genie-title="Reading" data-genie-key="ParentReading" element={<PageTransition transition="slide-up"><ParentReading /></PageTransition>} />
                  <Route path="achievements" data-genie-title="Achievements" data-genie-key="ParentAchievements" element={<PageTransition transition="slide-up"><ParentAchievements /></PageTransition>} />
                  <Route path="children" data-genie-title="Children" data-genie-key="ParentChildren" element={<Navigate to="/parent/settings" replace />} />
                  <Route path="statistics" data-genie-title="Statistics" data-genie-key="ParentStatistics" element={<PageTransition transition="slide-up"><ParentStatistics /></PageTransition>} />
                  <Route path="settings" data-genie-title="Settings" data-genie-key="ParentSettings" element={<PageTransition transition="slide-up"><ParentSettings /></PageTransition>} />
                </Route>

                {/* Catch-all Route */}
                <Route path="*" data-genie-key="NotFound" data-genie-title="Not Found" element={<PageTransition transition="fade"><NotFound /></PageTransition>} />
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

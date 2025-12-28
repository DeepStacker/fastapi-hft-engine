import { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { initializeAuth, setupAuthListener } from "./context/authSlice";
import { HelmetProvider } from "react-helmet-async";
import AuthRedirect from "./components/AuthRedirect";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { PersistGate } from 'redux-persist/integration/react';
import { persistor } from './context/store';

// Core Components (loaded immediately)
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import PrivateRoute from "./components/auth/PrivateRoute";
import ErrorBoundary from "./ErrorBoundary";
import MainLayout from "./layouts/MainLayout";

// Lazy-loaded Pages (code splitting for better initial load)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./components/auth/Profile"));
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const ContactUs = lazy(() => import("./pages/Contact"));
const Tca = lazy(() => import("./pages/Tca"));
const PositionSizing = lazy(() => import("./pages/PositionSizing"));
const OptionChain = lazy(() => import("./pages/OptionChain"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Historical = lazy(() => import("./pages/Historical"));
const SplitView = lazy(() => import("./pages/SplitView"));
const Screeners = lazy(() => import("./pages/Screeners"));
const Calculators = lazy(() => import("./pages/Calculators"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));

import { activateServices } from "./services/healthCheck";

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
    </div>
  </div>
);

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, authLoading } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.theme.theme);

  useEffect(() => {
    dispatch(initializeAuth());
    dispatch(setupAuthListener());
    activateServices();
  }, [dispatch]);

  // Show loading spinner while authentication is being initialized
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <PersistGate loading={null} persistor={persistor}>
          <Router>
            <AuthRedirect />
            <div className={theme === "dark" ? "dark" : "light"}>
              <ToastContainer position="top-right" />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Main Layout Routes */}
                  <Route element={<MainLayout />}>
                    {/* Auth Routes */}
                    <Route
                      path="/login"
                      element={
                        !isAuthenticated ? (
                          <Login />
                        ) : (
                          <Navigate to="/dashboard" replace />
                        )
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        !isAuthenticated ? (
                          <Register />
                        ) : (
                          <Navigate to="/dashboard" replace />
                        )
                      }
                    />

                    {/* Public Routes */}
                    <Route
                      path="/"
                      element={
                        isAuthenticated ? (
                          <Navigate to="/dashboard" replace />
                        ) : (
                          <Home />
                        )
                      }
                    />
                    <Route path="/about" element={<About />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/contact" element={<ContactUs />} />

                    {/* Protected Routes */}
                    <Route element={<PrivateRoute />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/option-chain" element={<OptionChain />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/historical" element={<Historical />} />
                      <Route path="/split-view" element={<SplitView />} />
                      <Route path="/screeners" element={<Screeners />} />
                      <Route path="/calculators" element={<Calculators />} />
                      <Route path="/position-sizing" element={<PositionSizing />} />
                      <Route path="/tca" element={<Tca />} />
                      <Route path="/admin" element={<Admin />} />
                    </Route>
                  </Route>
                  {/* 404 Route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
          </Router>
        </PersistGate>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;

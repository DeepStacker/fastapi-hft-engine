import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const AuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authLoading } = useSelector((state) => state.auth);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Only redirect after auth is loaded and user is authenticated
    if (!authLoading && isAuthenticated && !hasRedirectedRef.current) {
      const redirectPath = localStorage.getItem("redirectAfterLogin");

      // Only redirect if we have a stored redirect path and we're not already there
      if (redirectPath && location.pathname !== redirectPath) {
        localStorage.removeItem("redirectAfterLogin");
        navigate(redirectPath, { replace: true });
        hasRedirectedRef.current = true;
      } else if (!redirectPath && location.pathname === "/login") {
        // Default redirect from login page if no specific path is stored
        navigate("/dashboard", { replace: true });
        hasRedirectedRef.current = true;
      }
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname]);

  // Reset redirect flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasRedirectedRef.current = false;
    }
  }, [isAuthenticated]);

  return null;
};

export default AuthRedirect;

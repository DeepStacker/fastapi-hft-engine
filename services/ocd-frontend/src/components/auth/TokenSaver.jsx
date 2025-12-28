import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from "@clerk/clerk-react";

const TokenSaver = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { getToken } = useAuth();

  useEffect(() => {
    const getFirebaseTokenAndSave = async () => {
      try {
        const token = await getToken({ template: "firebase" });

        if (token) {
          localStorage.setItem('token', token);
          console.log('Firebase Token saved to localStorage (TokenSaver):', token);
          navigate('/dashboard', { replace: true });
        } else {
          console.error('Firebase Token not found (TokenSaver)');
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Error getting Firebase token (TokenSaver):', error);
        navigate('/login', { replace: true });
      }
    };

    getFirebaseTokenAndSave();
  }, [location, navigate, getToken]);

  return (
    <div>
      <h1>Saving token...</h1>
    </div>
  );
};

export default TokenSaver;

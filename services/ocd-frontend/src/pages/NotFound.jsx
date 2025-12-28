
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/common';

/**
 * Minimal 404 Not Found Page
 */
const NotFound = () => {
  const navigate = useNavigate();
  const theme = useSelector((state) => state.theme.theme);

  return (
    <div className={`min-h-[60vh] flex items-center justify-center px-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="text-center max-w-md">
        {/* 404 Display */}
        <h1 className="text-8xl font-black text-blue-600 dark:text-blue-500 mb-4">404</h1>

        <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Page Not Found
        </h2>

        <p className={`mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            <HomeIcon className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

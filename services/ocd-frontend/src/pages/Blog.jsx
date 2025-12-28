
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { NewspaperIcon } from '@heroicons/react/24/outline';
import { Card } from '../components/common';

/**
 * Minimal Blog Page - Placeholder
 * Blog functionality not yet implemented in backend
 */
const Blog = () => {
  const theme = useSelector((state) => state.theme.theme);

  return (
    <>
      <Helmet>
        <title>Blog | Stockify</title>
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className={`text-3xl font-bold text-center mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Financial Insights Blog
        </h1>

        <Card className="text-center py-16">
          <NewspaperIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Coming Soon
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            We&apos;re working on bringing you market insights and trading education.
            <br />Check back soon!
          </p>
        </Card>
      </div>
    </>
  );
};

export default Blog;

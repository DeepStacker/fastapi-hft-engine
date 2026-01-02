import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { sendPasswordReset } from '../../firebase/init';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const theme = useSelector((state) => state.theme?.theme || "light");
  const isDark = theme === "dark";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordReset(email);
      setSubmitted(true);
      toast.success('Reset link sent to your email! 📧');
    } catch (error) {
      console.error('Password Reset Error:', error);
      toast.error(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50'}`}>
      {/* Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className={`p-8 rounded-3xl shadow-2xl border backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <EnvelopeIcon className="w-8 h-8" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Reset Password
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              We'll send you instructions to reset your password.
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Email Address
                </label>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-blue-500' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
                    <EnvelopeIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 transition-all outline-none ${isDark
                        ? 'bg-slate-800/50 border-slate-700 text-white focus:border-blue-500 focus:bg-slate-800'
                        : 'bg-white border-slate-100 text-slate-900 focus:border-blue-500'
                      }`}
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl ${loading
                    ? 'bg-slate-400 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                  }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending link...
                  </div>
                ) : 'Send Reset Instructions'}
              </motion.button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-6 rounded-2xl border text-center ${isDark ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}
            >
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Check Your Inbox</h3>
              <p className="text-sm opacity-90">
                A password reset link has been sent to <strong>{email}</strong>.
              </p>
            </motion.div>
          )}

          {/* Links */}
          <div className="mt-8 text-center">
            <Link
              to="/login"
              className={`inline-flex items-center gap-2 text-sm font-bold transition-colors ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

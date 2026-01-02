import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { confirmPasswordReset } from '../../firebase/init';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useSelector((state) => state.theme?.theme || "light");
  const isDark = theme === "dark";

  const [oobCode, setOobCode] = useState(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Firebase sends the reset code in the URL as oobCode
    const params = new URLSearchParams(location.search);
    const code = params.get('oobCode');
    if (!code) {
      toast.error('Invalid or missing reset code. Please request a new link.');
    } else {
      setOobCode(code);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!oobCode) {
      toast.error('No reset code found. Please request a new link.');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset(oobCode, formData.password);
      setSuccess(true);
      toast.success('Password reset successful! 🎉');

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Reset Password Error:', error);
      toast.error(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50'}`}>
      {/* Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className={`p-8 rounded-3xl shadow-2xl border backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <LockClosedIcon className="w-8 h-8" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              New Password
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Please enter your new password below.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!success ? (
              <motion.form
                key="reset-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {/* New Password */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    New Password
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                      <LockClosedIcon className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`block w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 transition-all outline-none ${isDark
                          ? 'bg-slate-800/50 border-slate-700 text-white focus:border-indigo-500 focus:bg-slate-800'
                          : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'
                        }`}
                      placeholder="At least 8 characters"
                      disabled={!oobCode}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                      <LockClosedIcon className="w-5 h-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`block w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 transition-all outline-none ${isDark
                          ? 'bg-slate-800/50 border-slate-700 text-white focus:border-indigo-500 focus:bg-slate-800'
                          : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'
                        }`}
                      placeholder="Repeat new password"
                      disabled={!oobCode}
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={loading || !oobCode}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl ${loading || !oobCode
                      ? 'bg-slate-400 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/25'
                    }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating Password...
                    </div>
                  ) : 'Reset Password'}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success-msg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <CheckCircleIcon className="w-12 h-12" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Success!</h3>
                <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Your password has been reset successfully. You will be redirected to the login page in a few seconds.
                </p>
                <Link
                  to="/login"
                  className={`inline-flex items-center gap-2 font-bold text-indigo-500 hover:text-indigo-600 transition-colors bg-indigo-500/10 px-6 py-2 rounded-xl`}
                >
                  Go to Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Links */}
          {!success && (
            <div className="mt-8 text-center border-t pt-6 border-slate-100 dark:border-slate-800">
              <Link
                to="/login"
                className={`inline-flex items-center gap-2 text-sm font-bold transition-colors ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;

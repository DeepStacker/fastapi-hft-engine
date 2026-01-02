import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { signInWithGoogle, loginWithEmail } from "../../firebase/init";
import { setUser } from "../../context/authSlice";
import { toast } from "react-toastify";
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  BoltIcon,
  SparklesIcon,
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Manual Login State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const { isAuthenticated, user, authLoading } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.theme?.theme || "light");
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && mounted) {
      const redirectPath = localStorage.getItem("redirectAfterLogin") || "/dashboard";
      localStorage.removeItem("redirectAfterLogin");
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, authLoading, mounted]);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const user = await loginWithEmail(formData.email, formData.password);
      if (user) {
        const token = await user.getIdToken(true);
        localStorage.setItem("authToken", token);
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          token: token,
        };
        dispatch(setUser(userData));
        toast.success("Welcome back! 🎉");
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const user = await signInWithGoogle();
      if (user) {
        const token = await user.getIdToken(true);
        localStorage.setItem("authToken", token);
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          token: token,
        };
        dispatch(setUser(userData));
        toast.success("Welcome back! 🎉");
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: ChartBarIcon, text: "Real-time Options Data" },
    { icon: BoltIcon, text: "Advanced Analytics" },
    { icon: SparklesIcon, text: "Premium Features" },
  ];

  if (!mounted || authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Connecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'}`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -80, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 px-6 max-w-6xl mx-auto">
        {/* Left: Brand & Features */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 text-center lg:text-left"
        >
          {/* Logo */}
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ArrowTrendingUpIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Deep</span>
              <span className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Strike</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`text-4xl lg:text-5xl font-black mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Welcome Back,{' '}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Trader
            </span>
          </h1>

          <p className={`text-lg lg:text-xl mb-8 max-w-md ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Access real-time options analytics and make smarter trading decisions.
          </p>

          {/* Features */}
          <div className="flex flex-col gap-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm`}>
                  <feature.icon className="w-5 h-5 text-blue-500" />
                </div>
                <span className="font-medium">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className={`p-8 rounded-3xl shadow-2xl border backdrop-blur-sm ${isDark
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-white/80 border-slate-200'
            }`}>
            {/* Card Header */}
            <div className="text-center mb-8">
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Sign In
              </h2>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Continue with your Google account
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleManualLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Email Address
                </label>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-blue-500' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
                    <EnvelopeIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`block w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 transition-all outline-none ${isDark
                        ? 'bg-slate-800/50 border-slate-700 text-white focus:border-blue-500 focus:bg-slate-800'
                        : 'bg-white border-slate-100 text-slate-900 focus:border-blue-500'
                      }`}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-blue-500' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
                    <LockClosedIcon className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`block w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 transition-all outline-none ${isDark
                        ? 'bg-slate-800/50 border-slate-700 text-white focus:border-blue-500 focus:bg-slate-800'
                        : 'bg-white border-slate-100 text-slate-900 focus:border-blue-500'
                      }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <motion.button
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-xl ${loading
                    ? 'bg-slate-400 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                  }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>OR CONTINUE WITH</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'text-slate-200'}`} />
            </div>

            {/* Google Login Button */}
            <motion.button
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-bold transition-all border-2 ${isDark
                  ? 'bg-slate-800/50 border-slate-700 text-white hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200'
                }`}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Sign in with Google
            </motion.button>

            {/* Register Link */}
            <div className="text-center">
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Don&apos;t have an account?{' '}
                <Link to="/register" className="font-bold text-blue-500 hover:text-blue-600 transition-colors">
                  Sign up free
                </Link>
              </p>
            </div>

            {/* Trust Badge */}
            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className={`flex items-center justify-center gap-2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secured with 256-bit encryption</span>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className={`text-center mt-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Link to="/" className="hover:text-blue-500 transition-colors">Home</Link>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-blue-500 transition-colors">Privacy</a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-blue-500 transition-colors">Terms</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

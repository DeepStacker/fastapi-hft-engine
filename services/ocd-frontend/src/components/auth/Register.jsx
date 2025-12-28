import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { signInWithGoogle } from "../../firebase/init";
import { setUser } from "../../context/authSlice";
import { toast } from "react-toastify";
import {
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { isAuthenticated, user, authLoading } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.theme?.theme || "light");
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user && mounted) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate, authLoading, mounted]);

  const handleGoogleRegister = async () => {
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
          token,
        };
        dispatch(setUser(userData));
        toast.success("Account created! Welcome to DeepStrike 🚀");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Registration Error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "Real-time NIFTY & BANKNIFTY data",
    "Advanced Greeks analysis",
    "PCR, Max Pain & IV indicators",
    "Premium trading tools",
  ];

  if (!mounted || authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'}`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, -80, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 px-6 max-w-6xl mx-auto">
        {/* Left: Brand & Benefits */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 text-center lg:text-left"
        >
          {/* Logo */}
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <ArrowTrendingUpIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Deep</span>
              <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Strike</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`text-4xl lg:text-5xl font-black mb-4 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Start Trading{' '}
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
              Smarter
            </span>
          </h1>

          <p className={`text-lg lg:text-xl mb-8 max-w-md ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Create your free account and unlock professional-grade options analytics.
          </p>

          {/* Benefits */}
          <div className="flex flex-col gap-3">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              >
                <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                <span className="font-medium">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right: Register Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className={`p-8 rounded-3xl shadow-2xl border backdrop-blur-sm ${
            isDark 
              ? 'bg-slate-900/80 border-slate-800' 
              : 'bg-white/80 border-slate-200'
          }`}>
            {/* Card Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/30">
                <RocketLaunchIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Create Account
              </h2>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                It&apos;s free and takes 10 seconds
              </p>
            </div>

            {/* Google Register Button */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleRegister}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/30 hover:shadow-xl'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="w-6 h-6"
                  />
                  Sign up with Google
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>or</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            </div>

            {/* Login Link */}
            <div className="text-center">
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-purple-500 hover:text-purple-600 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            {/* Trust Badge */}
            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className={`flex items-center justify-center gap-2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No credit card required</span>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className={`text-center mt-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            By signing up, you agree to our{' '}
            <a href="#" className="text-purple-500 hover:underline">Terms</a>
            {' '}&{' '}
            <a href="#" className="text-purple-500 hover:underline">Privacy</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaGithub, FaLinkedin, FaTwitter, FaTelegram } from "react-icons/fa";
import {
  SiPython,
  SiReact,
  SiTailwindcss,
  SiRedux,
  SiDocker,
  SiFastapi,
} from "react-icons/si";
import {
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const Footer = () => {
  const theme = useSelector((state) => state.theme.theme);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll to top functionality
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection observer for footer animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );

    const footerElement = document.getElementById("footer");
    if (footerElement) observer.observe(footerElement);

    return () => observer.disconnect();
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return;
    }

    setSubscribed(true);
    setTimeout(() => {
      setSubscribed(false);
      setEmail("");
    }, 3000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Professional animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const techStack = [
    { icon: SiPython, name: "Python", color: "text-blue-500" },
    { icon: SiReact, name: "React", color: "text-blue-400" },
    { icon: SiTailwindcss, name: "Tailwind", color: "text-cyan-500" },
    { icon: SiRedux, name: "Redux", color: "text-purple-500" },
    { icon: SiFastapi, name: "FastAPI", color: "text-green-500" },
    { icon: SiDocker, name: "Docker", color: "text-blue-600" },
  ];

  const professionalLinks = [
    {
      icon: FaGithub,
      href: "https://github.com/SHIVAM9771",
      color: "hover:text-gray-600",
      label: "GitHub",
    },
    {
      icon: FaLinkedin,
      href: "https://linkedin.com/in/shivam-kumar",
      color: "hover:text-blue-600",
      label: "LinkedIn",
    },
    {
      icon: FaTwitter,
      href: "https://twitter.com/deepstrike",
      color: "hover:text-blue-500",
      label: "Twitter",
    },
    {
      icon: FaTelegram,
      href: "https://t.me/deepstrike",
      color: "hover:text-blue-500",
      label: "Telegram",
    },
  ];

  const complianceInfo = [
    { label: "SEBI Registration", value: "INZ000123456" },
    { label: "CIN", value: "U74999KA2024PTC123456" },
    { label: "ISO Certification", value: "ISO 27001:2013" },
  ];

  return (
    <>
      <footer
        id="footer"
        className={`relative ${
          theme === "dark"
            ? "bg-gray-900 border-t border-gray-800"
            : "bg-gray-50 border-t border-gray-200"
        }`}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute inset-0 opacity-[0.02] ${
              theme === "dark" ? "bg-white" : "bg-gray-900"
            }`}
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          className="relative z-10 container mx-auto px-6 py-12"
        >
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Company Information */}
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <div className="flex items-center mb-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`p-3 rounded-lg ${
                    theme === "dark" ? "bg-blue-600" : "bg-blue-500"
                  } shadow-lg mr-3`}
                >
                  <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                  <h3
                    className={`text-xl font-bold ${
                      theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    DeepStrike
                  </h3>
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Options Trading Platform
                  </p>
                </div>
              </div>

              <p
                className={`text-sm leading-relaxed mb-6 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Professional options trading platform with real-time analytics,
                risk management tools, and institutional-grade security.
              </p>

              {/* Compliance Information */}
              <div className="space-y-2 mb-6">
                {complianceInfo.map((item, index) => (
                  <div
                    key={index}
                    className={`text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    <span className="font-medium">{item.label}:</span>{" "}
                    {item.value}
                  </div>
                ))}
              </div>

              {/* Technology Stack */}
              <div>
                <p
                  className={`text-xs font-semibold mb-3 ${
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  BUILT WITH
                </p>
                <div className="flex flex-wrap gap-2">
                  {techStack.map((tech) => {
                    const Icon = tech.icon;
                    return (
                      <div
                        key={tech.name}
                        className={`flex items-center space-x-1 px-2 py-1 rounded-md ${
                          theme === "dark" ? "bg-gray-800" : "bg-white"
                        } border ${
                          theme === "dark"
                            ? "border-gray-700"
                            : "border-gray-200"
                        }`}
                      >
                        <Icon className={`w-3 h-3 ${tech.color}`} />
                        <span
                          className={`text-xs ${
                            theme === "dark" ? "text-gray-300" : "text-gray-700"
                          }`}
                        >
                          {tech.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Platform Links */}
            <motion.div variants={itemVariants}>
              <h3
                className={`text-lg font-semibold mb-6 ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Platform
              </h3>
              <ul className="space-y-3">
                {[
                  { to: "/", label: "Dashboard" },
                  { to: "/option-chain", label: "Options Chain" },
                  { to: "/risk-management", label: "Risk Management" },
                  { to: "/portfolio", label: "Portfolio Analysis" },
                  { to: "/market-data", label: "Market Data" },
                  { to: "/api-docs", label: "API Documentation" },
                ].map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={`text-sm transition-colors duration-200 ${
                        theme === "dark"
                          ? "text-gray-400 hover:text-blue-400"
                          : "text-gray-600 hover:text-blue-600"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Support & Legal */}
            <motion.div variants={itemVariants}>
              <h3
                className={`text-lg font-semibold mb-6 ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                Support & Legal
              </h3>
              <ul className="space-y-3">
                {[
                  { to: "/help", label: "Help Center" },
                  { to: "/contact", label: "Contact Support" },
                  { to: "/privacy", label: "Privacy Policy" },
                  { to: "/terms", label: "Terms of Service" },
                  { to: "/compliance", label: "Compliance" },
                  { to: "/security", label: "Security" },
                ].map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={`text-sm transition-colors duration-200 ${
                        theme === "dark"
                          ? "text-gray-400 hover:text-blue-400"
                          : "text-gray-600 hover:text-blue-600"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Contact & Updates */}
            <motion.div variants={itemVariants}>
              <h3
                className={`text-lg font-semibold mb-6 flex items-center ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                <EnvelopeIcon className="w-5 h-5 mr-2 text-blue-500" />
                Stay Informed
              </h3>

              {/* Contact Information */}
              <div className="space-y-3 mb-6">
                <div
                  className={`flex items-center text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  <PhoneIcon className="w-4 h-4 mr-2" />
                  <span>+91-80-1234-5678</span>
                </div>
                <div
                  className={`flex items-center text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  <EnvelopeIcon className="w-4 h-4 mr-2" />
                  <span>support@deepstrike.com</span>
                </div>
                <div
                  className={`flex items-start text-sm ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  <MapPinIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Bangalore, Karnataka, India</span>
                </div>
              </div>

              {/* Newsletter Signup */}
              <p
                className={`text-sm mb-4 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Get market insights and platform updates
              </p>

              <form onSubmit={handleSubscribe} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === "dark"
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  }`}
                />

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={subscribed}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {subscribed ? "Subscribed!" : "Subscribe"}
                </motion.button>
              </form>

              <AnimatePresence>
                {subscribed && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 flex items-center text-green-500 text-sm"
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Thank you for subscribing!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Professional Social Links */}
              <div className="mt-6">
                <p
                  className={`text-xs font-medium mb-3 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  CONNECT WITH US
                </p>
                <div className="flex space-x-3">
                  {professionalLinks.map((social) => {
                    const Icon = social.icon;
                    return (
                      <motion.a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.1 }}
                        className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                          theme === "dark"
                            ? "bg-gray-800 hover:bg-gray-700 text-gray-400"
                            : "bg-white hover:bg-gray-50 text-gray-600"
                        } ${social.color} border ${
                          theme === "dark"
                            ? "border-gray-700"
                            : "border-gray-200"
                        }`}
                        aria-label={social.label}
                      >
                        <Icon size={16} />
                      </motion.a>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom Section */}
          <motion.div
            variants={itemVariants}
            className={`border-t pt-6 ${
              theme === "dark" ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div
                className={`text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                <p>
                  &copy; {new Date().getFullYear()} DeepStrike Technologies Pvt
                  Ltd. All rights reserved.
                </p>
                <p className="mt-1">
                  Developed by{" "}
                  <span className="font-medium text-blue-600">
                    Shivam Kumar
                  </span>
                </p>
              </div>

              <div
                className={`flex items-center space-x-6 mt-4 md:mt-0 text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ClockIcon className="w-4 h-4" />
                  <span>24/7 Support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldCheckIcon className="w-4 h-4 text-green-500" />
                  <span>Secure Platform</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </footer>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className={`fixed bottom-8 right-8 p-3 rounded-full shadow-lg z-50 ${
              theme === "dark"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            <ArrowUpIcon className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default Footer;

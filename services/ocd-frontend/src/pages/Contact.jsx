import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  TicketIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/common';
import { supportService } from '../services/supportService';

/**
 * Contact Page - Premium Design
 * Connected to real support ticket API
 */
const Contact = () => {
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketId, setTicketId] = useState(null);

  const isDark = theme === 'dark';

  const categories = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'billing', label: 'Billing & Subscription' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' },
  ];

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      // Use real support ticket API
      const response = await supportService.createTicket({
        subject: formData.subject || `Contact: ${formData.category}`,
        category: formData.category,
        message: `From: ${formData.name} <${formData.email}>\n\n${formData.message}`,
        priority: 'medium',
      });

      if (response.success) {
        setIsSuccess(true);
        setTicketId(response.ticket?.id || response.id);
        toast.success('Your message has been submitted!');
        setFormData({ name: '', email: '', subject: '', category: 'general', message: '' });
      } else {
        throw new Error(response.message || 'Failed to submit');
      }
    } catch (error) {
      console.error('Contact form error:', error);

      // If not authenticated, show helpful message
      if (error.response?.status === 401) {
        toast.info('Please log in to send a support ticket, or email us directly.');
        // Still show success for UX - they can email directly
      } else {
        toast.error('Unable to submit. Please try again or email us directly.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Success state
  if (isSuccess) {
    return (
      <>
        <Helmet>
          <title>Message Sent | DeepStrike</title>
        </Helmet>
        <div className={`min-h-[85vh] flex items-center justify-center py-12 px-4 ${isDark
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950'
          : 'bg-gradient-to-br from-blue-50 via-white to-gray-50'
          }`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-center max-w-md p-8 rounded-3xl border ${isDark
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white/80 border-gray-200 shadow-xl'
              }`}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 mx-auto mb-6 bg-green-500/10 rounded-full flex items-center justify-center"
            >
              <CheckCircleIcon className="w-10 h-10 text-green-500" />
            </motion.div>
            <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Message Received!
            </h2>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Thank you for reaching out. We'll respond within 24 hours.
              {ticketId && (
                <span className="block mt-2 text-sm">
                  Ticket ID: <code className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">{ticketId}</code>
                </span>
              )}
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setIsSuccess(false)} variant="outline">
                Send Another
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Contact Us | DeepStrike</title>
        <meta name="description" content="Get in touch with the DeepStrike team for support, feedback, or partnership inquiries." />
      </Helmet>

      <div className={`min-h-[85vh] flex items-center justify-center py-12 px-4 transition-colors duration-300 ${isDark
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950'
        : 'bg-gradient-to-br from-blue-50 via-white to-gray-50'
        }`}>

        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-4xl md:text-5xl font-black mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Get in Touch
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Have questions or need support? We're here to help.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">

            {/* Left Column: Contact Info */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Info Cards */}
              {[
                { icon: EnvelopeIcon, title: 'Email Us', info: 'support@deepstrike.com', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { icon: ChatBubbleLeftRightIcon, title: 'Live Support', info: 'Available 9 AM - 6 PM IST', color: 'text-green-500', bg: 'bg-green-500/10' },
                { icon: TicketIcon, title: 'Support Tickets', info: 'Track your requests', color: 'text-purple-500', bg: 'bg-purple-500/10' },
                { icon: MapPinIcon, title: 'Location', info: 'Bangalore, India', color: 'text-amber-500', bg: 'bg-amber-500/10' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${isDark
                    ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-xl'
                    : 'bg-white/70 border-gray-200/50 backdrop-blur-xl shadow-lg shadow-gray-200/50'
                    }`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-xl ${item.bg}`}>
                      <item.icon className={`w-8 h-8 ${item.color}`} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                      <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.info}</p>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Quick Links */}
              {isAuthenticated && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className={`p-4 rounded-xl ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}
                >
                  <p className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                    💡 View your support tickets in the <button onClick={() => navigate('/profile')} className="underline font-medium">Profile</button> section.
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Right Column: Contact Form */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
            >
              <div className={`p-8 rounded-3xl border shadow-2xl ${isDark
                ? 'bg-gray-800/80 border-gray-700/50 backdrop-blur-xl shadow-black/20'
                : 'bg-white border-gray-100 shadow-blue-500/10'
                }`}>
                <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Send a Message</h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 sm:col-span-1">
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 sm:col-span-1">
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Subject</label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        placeholder="Brief subject"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                          }`}
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className={`w-full px-4 py-3 rounded-xl border outline-none transition-all resize-none ${isDark
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        }`}
                      placeholder="How can we help you today?"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="premium"
                    fullWidth
                    size="lg"
                    loading={isSubmitting}
                    icon={PaperAirplaneIcon}
                    className="mt-2"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </Button>

                  {!isAuthenticated && (
                    <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <button onClick={() => navigate('/login')} className="text-blue-500 hover:underline">Log in</button> for faster response and ticket tracking.
                    </p>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;

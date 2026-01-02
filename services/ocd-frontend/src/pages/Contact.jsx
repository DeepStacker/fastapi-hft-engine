
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { EnvelopeIcon, PhoneIcon, MapPinIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/common';

/**
 * Contact Page - Premium Design
 * Features glassmorphism cards, gradients, and animated interactions.
 */
const Contact = () => {
  const theme = useSelector((state) => state.theme.theme);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDark = theme === 'dark';

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    // In production, send to backend API
    setTimeout(() => {
      toast.success('Message sent! We will respond within 24 hours.');
      setFormData({ name: '', email: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
      <Helmet>
        <title>Contact Us | Stockify</title>
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
              Have questions about our algo strategies or need support? We're here to help.
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
                { icon: EnvelopeIcon, title: 'Email Us', info: 'support@stockify.com', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { icon: PhoneIcon, title: 'Call Us', info: '+91-80-1234-5678', color: 'text-green-500', bg: 'bg-green-500/10' },
                { icon: MapPinIcon, title: 'Visit Us', info: 'Bangalore, India', color: 'text-purple-500', bg: 'bg-purple-500/10' }
              ].map((item, i) => (
                <div key={i} className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${isDark
                  ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-xl'
                  : 'bg-white/70 border-gray-200/50 backdrop-blur-xl shadow-lg shadow-gray-200/50'
                  }`}>
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-xl ${item.bg}`}>
                      <item.icon className={`w-8 h-8 ${item.color}`} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                      <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.info}</p>
                    </div>
                  </div>
                </div>
              ))}
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
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${isDark
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message</label>
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
                    Send Message
                  </Button>
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

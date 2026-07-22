'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, TrendingUp, ArrowLeft } from 'lucide-react';
import { authForgotPassword, authConfirmForgotPassword } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Step = 'email' | 'reset' | 'done';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authForgotPassword(email);
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authConfirmForgotPassword(email, code, newPassword);
      setStep('done');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
            <TrendingUp size={20} className="text-black" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">StockApp</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-bold text-white mb-1">Reset password</h1>
              <p className="text-gray-400 text-sm mb-8">
                Enter your email and we&apos;ll send a reset code
              </p>
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail size={16} />}
                  required
                />
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <Button type="submit" size="full" loading={loading} className="mt-2">
                  {loading ? 'Sending...' : 'Send reset code'}
                </Button>
              </form>
            </motion.div>
          )}

          {step === 'reset' && (
            <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-bold text-white mb-1">New password</h1>
              <p className="text-gray-400 text-sm mb-8">
                Enter the code sent to <span className="text-white">{email}</span>
              </p>
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <Input
                  label="Reset code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  required
                />
                <Input
                  label="New password"
                  type="password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<Lock size={16} />}
                  required
                />
                {error && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <Button type="submit" size="full" loading={loading} className="mt-2">
                  {loading ? 'Resetting...' : 'Reset password'}
                </Button>
              </form>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Password reset!</h2>
              <p className="text-gray-400 text-sm">Redirecting you to sign in...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {step !== 'done' && (
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mt-6"
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        )}
      </motion.div>
    </div>
  );
}

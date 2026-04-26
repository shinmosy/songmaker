"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthPage({ mode }: { mode: "signup" | "signin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "mock" | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const { signUp, verifyEmail, signIn } = useAuth();
  const router = useRouter();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 9;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 9 characters");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(email, password);
      setDeliveryMethod(result.deliveryMethod);
      setShowInbox(result.deliveryMethod === "mock");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!verificationCode) {
      setError("Please enter verification code");
      return;
    }

    setIsLoading(true);

    try {
      await verifyEmail(email, verificationCode);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Allow admin bypass without email validation
    if (email === "admin") {
      if (!password) {
        setError("Password is required");
        return;
      }
    } else {
      if (!validateEmail(email)) {
        setError("Please enter a valid email address");
        return;
      }

      if (!password) {
        setError("Password is required");
        return;
      }
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  interface InboxMessage {
    id: string;
    to: string;
    subject: string;
    body: string;
    code: string;
    timestamp: string;
  }

  const getInbox = () => {
    const inbox = JSON.parse(localStorage.getItem("songmaker-inbox") || "[]") as InboxMessage[];
    return inbox.filter((msg: InboxMessage) => msg.to === email);
  };

  if (mode === "signup" && step === "verify") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">SongMaker</h1>
            <p className="text-gray-600">Verify your email</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            <p className="font-medium mb-2">📧 Check your inbox</p>
            <p>We sent a verification code to <strong>{email}</strong></p>
            {deliveryMethod === "mock" ? (
              <>
                <p className="mt-2 text-xs text-blue-600">
                  Email service sedang fallback ke mock inbox untuk testing.
                </p>
                <button
                  type="button"
                  onClick={() => setShowInbox(!showInbox)}
                  className="mt-3 text-blue-600 hover:underline font-medium text-sm"
                >
                  {showInbox ? "Hide inbox" : "View mock inbox"}
                </button>
              </>
            ) : (
              <p className="mt-2 text-xs text-blue-600">
                Cek inbox email beneran dan folder spam kalau belum masuk.
              </p>
            )}
          </div>

          {deliveryMethod === "mock" && showInbox && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-gray-600 mb-3">Mock Inbox:</p>
              {getInbox().length > 0 ? (
                getInbox().map((msg: InboxMessage) => (
                  <div key={msg.id} className="mb-3 p-3 bg-white border border-gray-200 rounded">
                    <p className="font-medium text-sm">{msg.subject}</p>
                    <p className="text-sm text-gray-600 mt-1">{msg.body}</p>
                    <button
                      type="button"
                      onClick={() => setVerificationCode(msg.code)}
                      className="mt-2 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                    >
                      Copy code
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No emails yet</p>
              )}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 transition-all"
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setVerificationCode("");
                setError(null);
                setDeliveryMethod(null);
                setShowInbox(false);
              }}
              className="text-black font-medium hover:underline"
            >
              Back to sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">SongMaker</h1>
          <p className="text-gray-600">
            {mode === "signup" ? "Create an account" : "Sign in to your account"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Password
              {mode === "signup" && (
                <span className="text-gray-500 text-xs ml-1">(min 9 characters)</span>
              )}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 transition-all"
          >
            {isLoading
              ? "Loading..."
              : mode === "signup"
                ? "Sign Up"
                : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <a href="/signin" className="text-black font-medium hover:underline">
                Sign in
              </a>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <a href="/signup" className="text-black font-medium hover:underline">
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

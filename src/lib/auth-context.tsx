"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface MockUser {
  id: string;
  email: string;
  role: "user" | "admin";
  verified: boolean;
}



interface SignUpResult {
  verificationCode: string;
}

interface AuthContextType {
  user: MockUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate 6-digit verification code
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("songmaker-user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error parsing stored user:", error);
      }
    }
    setIsLoading(false);
  }, []);

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    // Validate password length
    if (password.length < 9) {
      throw new Error("Password must be at least 9 characters");
    }

    // Check if user already exists
    const users = JSON.parse(localStorage.getItem("songmaker-users") || "{}");
    
    if (users[email]) {
      throw new Error("Email already registered");
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create user immediately (unverified)
    users[email] = {
      id: `user-${Date.now()}`,
      passwordHash: btoa(password),
      role: "user",
      verified: false,
    };

    localStorage.setItem("songmaker-users", JSON.stringify(users));

    // TODO: Send verification email via API (implement real email sending)
    // For now, return code to frontend for display
    
    return { verificationCode };
  };

  const verifyEmail = async (email: string, code: string) => {
    const users = JSON.parse(localStorage.getItem("songmaker-users") || "{}");
    const userRecord = users[email];

    if (!userRecord) {
      throw new Error("User not found");
    }

    // For now, accept any code (in production, store code with user)
    // This is simplified since we're not storing verification codes per user
    if (!code || code.length !== 6) {
      throw new Error("Invalid verification code");
    }

    // Mark user as verified
    userRecord.verified = true;
    users[email] = userRecord;
    localStorage.setItem("songmaker-users", JSON.stringify(users));

    // Auto sign in
    const loggedInUser: MockUser = {
      id: userRecord.id,
      email,
      role: userRecord.role,
      verified: true,
    };

    localStorage.setItem("songmaker-user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const signIn = async (email: string, password: string) => {
    // Hardcoded admin bypass
    if (email === "admin" && password === "superadmin") {
      const adminUser: MockUser = {
        id: "admin-001",
        email: "admin",
        role: "admin",
        verified: true,
      };
      localStorage.setItem("songmaker-user", JSON.stringify(adminUser));
      setUser(adminUser);
      return;
    }

    // Check user credentials
    const users = JSON.parse(localStorage.getItem("songmaker-users") || "{}");
    const userRecord = users[email];

    if (!userRecord || userRecord.passwordHash !== btoa(password)) {
      throw new Error("Invalid email or password");
    }

    if (!userRecord.verified) {
      throw new Error("Email not verified. Please check your inbox.");
    }

    const loggedInUser: MockUser = {
      id: userRecord.id,
      email,
      role: userRecord.role,
      verified: true,
    };

    localStorage.setItem("songmaker-user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const signOut = async () => {
    localStorage.removeItem("songmaker-user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signUp,
        verifyEmail,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

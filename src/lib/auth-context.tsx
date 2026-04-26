"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface MockUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

interface AuthContextType {
  user: MockUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const signUp = async (email: string, password: string) => {
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

    // Create new user
    const newUser: MockUser = {
      id: `user-${Date.now()}`,
      email,
      role: "user",
    };

    // Store password hash (simple base64 for demo, NOT production-safe)
    users[email] = {
      id: newUser.id,
      passwordHash: btoa(password),
      role: "user",
    };

    localStorage.setItem("songmaker-users", JSON.stringify(users));
    localStorage.setItem("songmaker-user", JSON.stringify(newUser));
    setUser(newUser);
  };

  const signIn = async (email: string, password: string) => {
    // Hardcoded admin bypass
    if (email === "admin" && password === "superadmin") {
      const adminUser: MockUser = {
        id: "admin-001",
        email: "admin",
        role: "admin",
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

    const loggedInUser: MockUser = {
      id: userRecord.id,
      email,
      role: userRecord.role,
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

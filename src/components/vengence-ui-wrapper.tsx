/**
 * Vengence UI Component Wrappers
 * Reusable styled components with Vengence UI aesthetic
 */

import React from 'react';

// Animated Button with gradient + glow
export const VengenceButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
  const baseStyles = 'relative overflow-hidden font-semibold transition-all duration-300 rounded-lg';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-[#00d9ff] to-[#8338ec] text-[#0a0e27] shadow-lg shadow-[#00d9ff]/50 hover:shadow-[#00d9ff]/80 hover:scale-105 active:scale-95',
    secondary: 'border border-[#00d9ff] text-[#00d9ff] hover:bg-[#00d9ff]/10 hover:shadow-lg hover:shadow-[#00d9ff]/30',
    ghost: 'text-[#a0aec0] hover:text-[#00d9ff] hover:bg-[#1a1f3a]/50',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <span className="relative z-10">{props.children}</span>
      {variant === 'primary' && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -left-full group-hover:left-full transition-all duration-500" />
      )}
    </button>
  );
});
VengenceButton.displayName = 'VengenceButton';

// Glow Border Card
export const VengenceCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    glowColor?: 'cyan' | 'pink' | 'purple';
  }
>(({ className = '', glowColor = 'cyan', ...props }, ref) => {
  const glowColors = {
    cyan: 'from-[#00d9ff] to-[#00d9ff]/0 shadow-[#00d9ff]/30',
    pink: 'from-[#ff006e] to-[#ff006e]/0 shadow-[#ff006e]/30',
    purple: 'from-[#8338ec] to-[#8338ec]/0 shadow-[#8338ec]/30',
  };

  return (
    <div
      ref={ref}
      className={`relative rounded-xl overflow-hidden ${className}`}
      {...props}
    >
      {/* Glow border effect */}
      <div className={`absolute inset-0 bg-gradient-to-r ${glowColors[glowColor]} opacity-0 hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl`} />
      
      {/* Card content */}
      <div className="relative bg-[#1a1f3a]/60 backdrop-blur-md border border-[#2d3561] hover:border-[#00d9ff]/50 transition-colors duration-300 rounded-xl p-6">
        {props.children}
      </div>
    </div>
  );
});
VengenceCard.displayName = 'VengenceCard';

// Neon Input
export const VengenceInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full bg-[#1a1f3a]/60 border border-[#2d3561] rounded-lg px-4 py-2.5 text-white placeholder-[#a0aec0] transition-all duration-300 focus:outline-none focus:border-[#00d9ff] focus:shadow-lg focus:shadow-[#00d9ff]/30 backdrop-blur-md ${className}`}
      {...props}
    />
  );
});
VengenceInput.displayName = 'VengenceInput';

// Neon Textarea
export const VengenceTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = '', ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={`w-full bg-[#1a1f3a]/60 border border-[#2d3561] rounded-lg px-4 py-2.5 text-white placeholder-[#a0aec0] transition-all duration-300 focus:outline-none focus:border-[#00d9ff] focus:shadow-lg focus:shadow-[#00d9ff]/30 backdrop-blur-md resize-none ${className}`}
      {...props}
    />
  );
});
VengenceTextarea.displayName = 'VengenceTextarea';

// Tag Button (toggle)
export const VengenceTag = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
  }
>(({ className = '', active = false, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
        active
          ? 'bg-gradient-to-r from-[#00d9ff] to-[#8338ec] text-[#0a0e27] shadow-lg shadow-[#00d9ff]/50'
          : 'border border-[#2d3561] text-[#a0aec0] hover:border-[#00d9ff] hover:text-[#00d9ff]'
      } ${className}`}
      {...props}
    />
  );
});
VengenceTag.displayName = 'VengenceTag';

// Select/Dropdown
export const VengenceSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={`w-full bg-[#1a1f3a]/60 border border-[#2d3561] rounded-lg px-4 py-2.5 text-white transition-all duration-300 focus:outline-none focus:border-[#00d9ff] focus:shadow-lg focus:shadow-[#00d9ff]/30 backdrop-blur-md appearance-none cursor-pointer ${className}`}
      {...props}
    />
  );
});
VengenceSelect.displayName = 'VengenceSelect';

// Badge/Label
export const VengenceBadge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'success' | 'warning' | 'error';
  }
>(({ className = '', variant = 'default', ...props }, ref) => {
  const variantStyles = {
    default: 'bg-[#00d9ff]/20 text-[#00d9ff] border border-[#00d9ff]/30',
    success: 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30',
    warning: 'bg-[#ffaa00]/20 text-[#ffaa00] border border-[#ffaa00]/30',
    error: 'bg-[#ff006e]/20 text-[#ff006e] border border-[#ff006e]/30',
  };

  return (
    <div
      ref={ref}
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
});
VengenceBadge.displayName = 'VengenceBadge';

import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border rounded-xl shadow-2xs active:scale-[0.98]';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-3.5 py-2 gap-2 h-9',
    lg: 'text-sm px-4 py-2.5 gap-2.5 h-10',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600/90 hover:from-indigo-700 hover:to-blue-700 hover:border-indigo-700 active:from-indigo-800 active:to-blue-800 shadow-sm shadow-indigo-500/20 font-semibold',
    accent:
      'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-500/15 font-semibold',
    secondary:
      'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:bg-slate-100 shadow-2xs',
    outline:
      'bg-white/60 text-indigo-700 border-indigo-200 hover:bg-indigo-50/70 hover:border-indigo-300 hover:text-indigo-800',
    danger:
      'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 hover:from-rose-700 hover:to-red-700 active:from-rose-800 active:to-red-800 shadow-sm shadow-rose-500/20 font-semibold',
    ghost:
      'bg-transparent text-slate-600 border-transparent hover:bg-indigo-50/60 hover:text-indigo-700',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
};

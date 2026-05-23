import { cn } from "../lib/utils";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
  className?: string;
}

export default function Button({
  variant = 'secondary',
  children,
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] border-[#2563EB]',
    secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 border-transparent',
  };

  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

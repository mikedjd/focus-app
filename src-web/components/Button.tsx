import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'ink' | 'quiet';
  children: ReactNode;
}

const variants = {
  primary: 'bg-sienna text-paper border-sienna hover:-translate-y-0.5 hover:shadow-soft',
  ghost: 'bg-transparent text-ink-soft border-rule hover:border-sienna hover:text-sienna',
  ink: 'bg-ink text-paper border-ink hover:-translate-y-0.5',
  quiet: 'bg-paper/10 text-paper border-paper/15 hover:bg-paper/15',
};

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-[14px] font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

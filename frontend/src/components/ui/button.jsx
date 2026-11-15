import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-emerald-600 text-white shadow hover:bg-emerald-500 shadow-emerald-950/20',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
        outline:
          'border border-slate-700/50 bg-slate-900/60 text-slate-200 shadow-sm hover:bg-slate-800/80 hover:text-white',
        secondary:
          'bg-slate-800 text-slate-100 shadow-sm hover:bg-slate-700/90 border border-slate-700/40',
        ghost: 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
        link: 'text-emerald-400 underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-9 w-9 p-0'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };

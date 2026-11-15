import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-slate-800 text-slate-100',
        secondary: 'border-slate-700/60 bg-slate-800/80 text-slate-200',
        outline: 'border-slate-700 text-slate-300',
        destructive: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
        live: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold uppercase tracking-wider',
        wicket: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
        four: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
        six: 'border-violet-500/40 bg-violet-950/40 text-violet-300',
        milestone: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
        shift: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

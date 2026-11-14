import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { ConfigurationError } from './App.jsx';

const styles = readFileSync('src/App.css', 'utf8');

const clerkState = vi.hoisted(() => ({ signedIn: false }));

vi.mock('@clerk/react', () => ({
  Show: ({ children, fallback = null, when }) =>
    (when === 'signed-in' && clerkState.signedIn) || (when === 'signed-out' && !clerkState.signedIn)
      ? children
      : fallback,
  SignInButton: ({ children }) => children,
  SignUpButton: ({ children }) => children,
  UserButton: () => <button type="button" aria-label="Open user menu" />,
  useAuth: () => ({ getToken: vi.fn() })
}));

describe('App', () => {
  beforeEach(() => {
    clerkState.signedIn = false;
    window.history.replaceState({}, '', '/');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('explains the product and offers Clerk sign-in actions without requesting match data', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Every important ball, made clear.' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to follow a match' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /view matches/i })).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gives signed-in visitors a clear continuation without requesting protected data', () => {
    clerkState.signedIn = true;
    render(<App />);

    expect(screen.getByRole('button', { name: 'Open user menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view matches/i })).toHaveAttribute('href', '/matches');
    expect(
      screen.queryByRole('button', { name: 'Sign in to follow a match' })
    ).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the protected match directory behind authentication without requesting data', () => {
    window.history.replaceState({}, '', '/matches');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Sign in to view matches.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the protected match workspace behind authentication without requesting data', () => {
    window.history.replaceState({}, '', '/matches/match-123');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Sign in to view matches.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses a keyboard-first focus order with a skip link before navigation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Dream Companion home' })).toHaveFocus();
  });

  it('declares a single-column layout for narrow screens', () => {
    expect(styles).toMatch(/@media \(max-width: 700px\)/);
    expect(styles).toMatch(/\.capability-grid\s*\{\s*grid-template-columns: 1fr;/);
  });

  it('renders a useful configuration state when Clerk is unavailable', () => {
    render(<ConfigurationError />);

    expect(
      screen.getByRole('heading', { name: 'Authentication setup required' })
    ).toBeInTheDocument();
    expect(screen.getByText('VITE_CLERK_PUBLISHABLE_KEY')).toBeInTheDocument();
  });
});

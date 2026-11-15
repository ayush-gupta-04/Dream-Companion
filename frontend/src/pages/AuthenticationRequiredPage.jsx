import { SignInButton } from '@clerk/react';

export function AuthenticationRequiredPage() {
  return (
    <main
      className="workspace-shell content-width"
      id="main-content"
      aria-labelledby="sign-in-title"
    >
      <p className="eyebrow">Match directory</p>
      <h1 id="sign-in-title">Sign in to view matches.</h1>
      <p>Match data is available only to authenticated fans.</p>
      <SignInButton>
        <button className="button button-primary" type="button">
          Sign in
        </button>
      </SignInButton>
    </main>
  );
}

export const AuthenticationRequired = AuthenticationRequiredPage;

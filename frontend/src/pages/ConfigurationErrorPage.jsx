export function ConfigurationErrorPage() {
  return (
    <main className="configuration-error" aria-labelledby="configuration-title">
      <p className="eyebrow">Dream Companion</p>
      <h1 id="configuration-title">Authentication setup required</h1>
      <p>
        Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to the frontend environment before starting the
        app.
      </p>
    </main>
  );
}

export const ConfigurationError = ConfigurationErrorPage;

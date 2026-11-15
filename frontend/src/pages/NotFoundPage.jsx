export function NotFoundPage() {
  return (
    <main
      className="workspace-shell content-width"
      id="main-content"
      aria-labelledby="not-found-title"
    >
      <p className="eyebrow">Page not found</p>
      <h1 id="not-found-title">That page is not available.</h1>
      <p>Return home to choose a supported next step.</p>
      <a className="button button-primary" href="/">
        Return home
      </a>
    </main>
  );
}

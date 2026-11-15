import { Show, UserButton } from '@clerk/react';

export function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header content-width">
        <a className="brand" href="/" aria-label="Dream Companion home">
          <span className="brand-mark" aria-hidden="true">
            DC
          </span>
          <span>Dream Companion</span>
        </a>

        <Show when="signed-in">
          <div className="account-menu" aria-label="Account menu">
            <UserButton />
          </div>
        </Show>
      </header>
    </>
  );
}

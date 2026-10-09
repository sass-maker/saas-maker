import {
  type CaptureConfig,
  type CaptureKind,
  CONSENT_COPY_V1,
  DEFAULT_API_BASE_URL,
  DEFAULT_SOURCE,
  fetchCaptureConfig,
  normalizeApiBaseUrl,
  submitSubscription,
  validateSubscriptionRequest,
} from './contract';

export const NEWSLETTER_CAPTURE_TAG = 'saas-maker-newsletter-capture';

const styleText = `
  :host {
    --newsletter-capture-text: inherit;
    --newsletter-capture-muted: color-mix(in srgb, currentColor 68%, transparent);
    --newsletter-capture-border: color-mix(in srgb, currentColor 17%, transparent);
    --newsletter-capture-surface: color-mix(in srgb, currentColor 3.5%, transparent);
    --newsletter-capture-focus: #2563eb;
    --newsletter-capture-action: #176b43;
    --newsletter-capture-action-text: #fff;
    --newsletter-capture-success: #187347;
    --newsletter-capture-error: #a32929;
    display: block;
    width: 100%;
    min-width: 0;
    color: var(--newsletter-capture-text);
    font: inherit;
    font-family: var(--fleet-footer-ui-font, inherit);
  }
  :host([theme='light']) { --newsletter-capture-text:#292824; --newsletter-capture-muted:#686860; --newsletter-capture-border:#d8d8cf; --newsletter-capture-surface:#f7f7f2; --newsletter-capture-focus:#1d4ed8; --newsletter-capture-action:#176b43; --newsletter-capture-action-text:#fff; --newsletter-capture-success:#187347; --newsletter-capture-error:#a32929; }
  :host([theme='dark']) { --newsletter-capture-text:#f2f1e9; --newsletter-capture-muted:#a7a69c; --newsletter-capture-border:#42433c; --newsletter-capture-surface:#20211d; --newsletter-capture-focus:#93c5fd; --newsletter-capture-action:#9bd7b5; --newsletter-capture-action-text:#14271c; --newsletter-capture-success:#a8e2bd; --newsletter-capture-error:#ffaaa3; }
  * { box-sizing: border-box; }
  .frame { border-top: 1px solid var(--newsletter-capture-border); padding: 1.25rem clamp(1rem, 3vw, 2rem); }
  .layout { display: grid; grid-template-columns: minmax(13rem, .72fr) minmax(0, 1.28fr); align-items: center; gap: clamp(1rem, 3vw, 2.5rem); max-width: 72rem; margin: 0 auto; }
  .intro { min-width: 0; }
  h2 { margin: 0; font-size: clamp(1rem, 1.25vw, 1.125rem); font-weight: 680; letter-spacing: -.025em; line-height: 1.3; }
  .description { max-width: 34rem; margin: .32rem 0 0; color: var(--newsletter-capture-muted); font-size: .8125rem; line-height: 1.5; }
  form { display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(9rem, .7fr) auto; gap: .55rem; align-items: end; min-width: 0; }
  form.form--fixed { grid-template-columns: minmax(10rem, 1fr) auto; }
  .field { display: grid; gap: .3rem; min-width: 0; }
  .field-label { color: var(--newsletter-capture-muted); font-size: .72rem; font-weight: 650; letter-spacing: .025em; }
  input[type='email'], select, button { min-width: 0; min-height: 2.75rem; border: 1px solid var(--newsletter-capture-border); border-radius: .35rem; font: inherit; }
  input[type='email'], select { width: 100%; padding: .55rem .7rem; color: inherit; background: var(--newsletter-capture-surface); font-size: .875rem; }
  input[type='email']::placeholder { color: var(--newsletter-capture-muted); opacity: .88; }
  input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--newsletter-capture-focus); outline-offset: 2px; }
  .submit { padding: .55rem 1rem; border-color: var(--newsletter-capture-action); background: var(--newsletter-capture-action); color: var(--newsletter-capture-action-text); cursor: pointer; font-size: .8125rem; font-weight: 700; white-space: nowrap; transition: filter 140ms ease, transform 140ms ease; }
  .submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .submit:disabled { cursor: wait; opacity: .72; }
  .consent-row { grid-column: 1 / -1; display: flex; min-height: 2.75rem; align-items: center; gap: .52rem; padding-block: .2rem; cursor: pointer; }
  .consent-row input { width: 1rem; height: 1rem; flex: 0 0 auto; margin: 0; accent-color: var(--newsletter-capture-action); }
  .consent-copy { color: var(--newsletter-capture-muted); font-size: .75rem; line-height: 1.45; }
  a { color: inherit; text-underline-offset: .18em; }
  .status { grid-column: 1 / -1; min-height: 1.2em; margin: -.05rem 0 0; font-size: .8rem; line-height: 1.4; }
  .status:empty { display: none; }
  .status[data-state='success'] { color: var(--newsletter-capture-success); }
  .status[data-state='error'] { color: var(--newsletter-capture-error); }
  .status[data-state='loading'] { color: var(--newsletter-capture-muted); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  @media (max-width: 48rem) {
    .layout { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
    form { grid-template-columns: minmax(0, 1fr) auto; }
    .field--email { grid-column: 1 / -1; }
    .form--fixed .field--email { grid-column: 1; }
    .field--kind { grid-column: 1; }
    .submit { grid-column: 2; align-self: end; }
  }
  @media (max-width: 26rem) {
    .frame { padding-inline: .9rem; }
    form { grid-template-columns: minmax(0, 1fr); }
    .field--email, .field--kind, .submit { grid-column: 1; }
    .form--fixed .field--email { grid-column: 1; }
    .submit { width: 100%; }
  }
  :host([integrated]) .frame { border-top: 0; }
  :host([integrated]) h2 { font-size: 16px; font-weight: 600; letter-spacing: -.02em; }
  :host([integrated]) .field-label { font-family: var(--fleet-footer-mono-font, monospace); font-size: 12px; font-weight: 400; letter-spacing: .04em; }
  :host([integrated]) input[type='email'], :host([integrated]) select { font-size: 16px; }
  :host([integrated]) .consent-copy { font-size: 12px; }
  :host([integrated]) .submit { font-size: 14px; font-weight: 500; }

  :host([layout='compact']) .frame { padding: 0; }
  :host([layout='compact']) .layout { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  :host([layout='compact']) form { grid-template-columns: minmax(0, 1fr); }
  :host([layout='compact']) form.form--fixed { grid-template-columns: minmax(0, 1fr) auto; }
  :host([layout='compact']) .field--email, :host([layout='compact']) .field--kind, :host([layout='compact']) .submit { grid-column: 1; }
  :host([layout='compact']) .submit { width: 100%; }
  :host([layout='compact']) .form--fixed .submit { grid-column: 2; width: auto; }
  @media (max-width: 26rem) { :host([layout='compact']) form.form--fixed { grid-template-columns: minmax(0, 1fr); } :host([layout='compact']) .form--fixed .submit { grid-column: 1; width: 100%; } }
  @media (prefers-reduced-motion: reduce) {
    .submit { transition: none; }
    .submit:hover:not(:disabled) { transform: none; }
  }
`;

function validKind(value: string | null): CaptureKind {
  return value === 'waitlist' ? 'waitlist' : 'newsletter';
}

function createText(tag: string, className: string, text = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function validPrivacyUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function registerNewsletterCapture(): void {
  if (typeof window === 'undefined' || customElements.get(NEWSLETTER_CAPTURE_TAG)) return;

  class NewsletterCaptureElement extends HTMLElement {
    static observedAttributes = [
      'product-name',
      'project-key',
      'catalog-id',
      'kind',
      'source',
      'api-base-url',
      'privacy-url',
      'label',
      'theme',
      'allow-kind-selection',
    ];

    private form?: HTMLFormElement;
    private kindSelect?: HTMLSelectElement;
    private emailInput?: HTMLInputElement;
    private consentInput?: HTMLInputElement;
    private submitButton?: HTMLButtonElement;
    private status?: HTMLParagraphElement;
    // Resolved publishable key for catalog-id mode. Cleared on disconnect or
    // when attributes change so a stale async response cannot mutate state.
    private resolvedProjectKey = '';
    private configState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    // Monotonic token guarding against stale config fetches across disconnect,
    // reconnect, and attribute changes. Only the latest token may apply state.
    private configToken = 0;
    private abortController?: AbortController;
    private renderedConfig = '';
    private submissionToken = 0;
    private submissionStatusOwned = false;

    connectedCallback(): void {
      if (!this.form || this.renderedConfig !== this.configSignature()) this.render();
      this.updateConfigStatus();
    }

    disconnectedCallback(): void {
      this.submissionToken += 1;
      this.submissionStatusOwned = false;
      if (this.submitButton) this.submitButton.disabled = false;
      this.form?.setAttribute('aria-busy', 'false');
      this.setStatus('', '');
      this.configToken += 1;
      this.abortController?.abort();
      this.abortController = undefined;
      this.resolvedProjectKey = '';
      this.configState = 'idle';
    }

    attributeChangedCallback(name: string): void {
      if (!this.isConnected) return;
      this.render();
      // project-key or catalog-id changes invalidate any resolved key.
      if (name === 'project-key' || name === 'catalog-id' || name === 'api-base-url') {
        this.resolvedProjectKey = '';
        this.configState = 'idle';
        this.configToken += 1;
        this.abortController?.abort();
        this.updateConfigStatus();
      }
    }

    private configSignature(): string {
      return JSON.stringify(
        NewsletterCaptureElement.observedAttributes.map((name) => [name, this.getAttribute(name)])
      );
    }

    private render(): void {
      this.submissionStatusOwned = false;
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      root.replaceChildren();

      const style = document.createElement('style');
      style.textContent = styleText;
      const region = document.createElement('section');
      region.className = 'frame';
      region.setAttribute('aria-label', this.getAttribute('label') || 'Email updates');
      const layout = createText('div', 'layout');
      const intro = createText('div', 'intro');
      const heading = createText('h2', '', `Get ${this.productName()} updates`);
      const allowKindSelection = this.hasAttribute('allow-kind-selection');
      const configuredKind = validKind(this.getAttribute('kind'));
      const description = createText(
        'p',
        'description',
        allowKindSelection
          ? `Choose occasional ${this.productName()} newsletter notes or early-access updates.`
          : configuredKind === 'waitlist'
            ? `Get ${this.productName()} early-access and availability updates.`
            : `Get occasional ${this.productName()} newsletter notes.`
      );
      intro.append(heading, description);

      const form = document.createElement('form');
      this.form = form;
      form.noValidate = false;
      form.setAttribute('aria-busy', 'false');

      const emailField = createText('label', 'field field--email');
      const emailLabel = createText('span', 'field-label', 'Email address');
      this.emailInput = document.createElement('input');
      this.emailInput.type = 'email';
      this.emailInput.name = 'email';
      this.emailInput.required = true;
      this.emailInput.maxLength = 254;
      this.emailInput.autocomplete = 'email';
      this.emailInput.placeholder = 'you@example.com';
      emailField.append(emailLabel, this.emailInput);

      this.kindSelect = undefined;
      let kindField: HTMLElement | undefined;
      if (allowKindSelection) {
        kindField = createText('label', 'field field--kind');
        const kindLabel = createText('span', 'field-label', 'Email type');
        const kindSelect = document.createElement('select');
        this.kindSelect = kindSelect;
        kindSelect.name = 'kind';
        kindSelect.setAttribute('aria-label', 'Email type');
        for (const [value, label] of [
          ['newsletter', 'Newsletter'],
          ['waitlist', 'Early access waitlist'],
        ]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          kindSelect.append(option);
        }
        kindSelect.value = configuredKind;
        kindField.append(kindLabel, kindSelect);
      }
      form.classList.toggle('form--fixed', !allowKindSelection);

      this.submitButton = document.createElement('button');
      this.submitButton.className = 'submit';
      this.submitButton.type = 'submit';
      this.updateSubmitLabel();

      const consentLabel = createText('label', 'consent-row');
      this.consentInput = document.createElement('input');
      this.consentInput.type = 'checkbox';
      this.consentInput.name = 'consent';
      this.consentInput.required = true;
      const consentCopy = createText('span', 'consent-copy');
      this.updateConsentCopy(consentCopy);
      consentLabel.append(this.consentInput, consentCopy);

      const status = document.createElement('p');
      this.status = status;
      status.className = 'status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      form.append(emailField);
      if (kindField) form.append(kindField);
      form.append(this.submitButton, consentLabel, status);
      layout.append(intro, this.form);
      region.append(layout);
      root.append(style, region);

      this.kindSelect?.addEventListener('change', () => {
        if (this.consentInput) this.consentInput.checked = false;
        this.updateConsentCopy(consentCopy);
        this.updateSubmitLabel();
        this.setStatus('', '');
      });
      this.emailInput.addEventListener('input', () => this.setStatus('', ''));
      this.consentInput.addEventListener('change', () => this.setStatus('', ''));
      form.addEventListener('submit', (event) => void this.onSubmit(event));
      this.renderedConfig = this.configSignature();
    }

    private productName(): string {
      return this.getAttribute('product-name')?.trim() || 'Product';
    }

    /**
     * Resolve the publishable project key for catalog-id mode. Explicit
     * project-key always wins and skips the fetch. Lifecycle-safe: a monotonic
     * token discards stale responses after disconnect or attribute changes,
     * and an AbortSignal cancels the in-flight request on disconnect.
     */
    private async loadConfigIfNeeded(): Promise<void> {
      // Explicit project-key mode: no config fetch, no pending state.
      const explicitKey = (this.getAttribute('project-key') || '').trim();
      if (explicitKey) {
        this.resolvedProjectKey = '';
        this.configState = 'idle';
        this.updateConfigStatus();
        return;
      }
      const catalogId = (this.getAttribute('catalog-id') || '').trim();
      if (!catalogId) {
        this.resolvedProjectKey = '';
        this.configState = 'idle';
        this.updateConfigStatus();
        return;
      }
      if (this.configState === 'loading' || this.configState === 'ready') return;

      const token = ++this.configToken;
      this.abortController?.abort();
      this.abortController = new AbortController();
      this.configState = 'loading';
      this.updateConfigStatus();

      try {
        const config: CaptureConfig = await fetchCaptureConfig(catalogId, {
          apiBaseUrl: this.getAttribute('api-base-url') || DEFAULT_API_BASE_URL,
          signal: this.abortController.signal,
        });
        if (token !== this.configToken || !this.isConnected) return;
        this.resolvedProjectKey = config.api_key;
        this.configState = 'ready';
        this.updateConfigStatus();
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        if (token !== this.configToken || !this.isConnected) return;
        this.resolvedProjectKey = '';
        this.configState = 'error';
        this.updateConfigStatus();
      }
    }

    private updateConfigStatus(): void {
      if (!this.status || this.submissionStatusOwned) return;
      if (this.configState === 'loading') {
        this.status.textContent = 'Preparing signup form…';
        this.status.dataset.state = 'loading';
      } else if (this.configState === 'error') {
        this.status.textContent = 'This signup form is not configured yet.';
        this.status.dataset.state = 'error';
      } else if (
        this.configState === 'idle' &&
        !this.hasExplicitOrResolvedKey() &&
        !this.getAttribute('catalog-id')
      ) {
        // No project-key and no catalog-id: leave a quiet not-configured note.
        this.status.textContent = 'This signup form is not configured yet.';
        this.status.dataset.state = 'error';
      } else if (this.configState !== 'idle') {
        // ready or stale-loading cleared back to ready: clear config status.
        this.status.textContent = '';
        delete this.status.dataset.state;
      }
    }

    private hasExplicitOrResolvedKey(): boolean {
      return Boolean((this.getAttribute('project-key') || '').trim() || this.resolvedProjectKey);
    }

    private updateConsentCopy(copy: Element): void {
      copy.replaceChildren();
      const kind = this.currentKind();
      const statement = document.createTextNode(CONSENT_COPY_V1[kind]);
      copy.append(statement);
      const privacyUrl = validPrivacyUrl(this.getAttribute('privacy-url'));
      if (privacyUrl) {
        copy.append(document.createTextNode(' '));
        const link = document.createElement('a');
        link.href = privacyUrl;
        link.textContent = 'Privacy policy';
        copy.append(link);
      }
    }

    private updateSubmitLabel(): void {
      if (!this.submitButton) return;
      this.submitButton.textContent =
        this.currentKind() === 'waitlist' ? 'Join waitlist' : 'Sign up';
    }

    private currentKind(): CaptureKind {
      return this.kindSelect?.value === 'waitlist'
        ? 'waitlist'
        : validKind(this.getAttribute('kind'));
    }

    private setStatus(message: string, state: 'loading' | 'success' | 'error' | ''): void {
      if (!this.status) return;
      if (!message) this.submissionStatusOwned = false;
      this.status.textContent = message;
      if (state) this.status.dataset.state = state;
      else delete this.status.dataset.state;
    }

    private async onSubmit(event: SubmitEvent): Promise<void> {
      event.preventDefault();
      if (!this.form || !this.emailInput || !this.consentInput) return;
      if (!this.form.reportValidity()) return;

      let input: ReturnType<typeof validateSubscriptionRequest>;
      let apiBaseUrl = DEFAULT_API_BASE_URL;
      try {
        input = validateSubscriptionRequest({
          email: this.emailInput.value,
          kind: this.currentKind(),
          source: this.getAttribute('source') || DEFAULT_SOURCE,
          consent: this.consentInput.checked,
        });
        apiBaseUrl = normalizeApiBaseUrl(
          this.getAttribute('api-base-url') || DEFAULT_API_BASE_URL,
          document.baseURI
        );
      } catch (error) {
        this.setStatus(
          error instanceof Error ? error.message : 'Check the form and try again.',
          'error'
        );
        return;
      }

      if (!this.submitButton) return;
      const form = this.form;
      const config = this.configSignature();
      const token = ++this.submissionToken;
      const isCurrentSubmission = () =>
        this.isConnected &&
        this.form === form &&
        this.configSignature() === config &&
        this.submissionToken === token;
      this.submitButton.disabled = true;
      this.submissionStatusOwned = true;
      form.setAttribute('aria-busy', 'true');
      this.setStatus('Sending your request…', 'loading');
      try {
        // Resolve only after a valid, consented submission. Page views and
        // crawlers never need this publishable configuration.
        await this.loadConfigIfNeeded();
        if (!isCurrentSubmission()) return;
        const projectKey =
          (this.getAttribute('project-key') || '').trim() || this.resolvedProjectKey;
        if (!projectKey) throw new Error('This signup form is not configured yet.');
        await submitSubscription(input, { projectKey, apiBaseUrl });
        if (!isCurrentSubmission()) return;
        form.reset();
        this.resolvedProjectKey = '';
        this.configState = 'idle';
        if (this.kindSelect) this.kindSelect.value = validKind(this.getAttribute('kind'));
        this.updateSubmitLabel();
        const consentCopy = this.form.querySelector('.consent-copy');
        if (consentCopy) this.updateConsentCopy(consentCopy);
        this.setStatus('Thanks. Your request has been received.', 'success');
      } catch (error) {
        if (!isCurrentSubmission()) return;
        this.setStatus(
          error instanceof Error
            ? error.message
            : 'Your request could not be sent. Please try again.',
          'error'
        );
      } finally {
        if (isCurrentSubmission()) {
          this.submitButton.disabled = false;
          form.setAttribute('aria-busy', 'false');
        }
      }
    }
  }

  customElements.define(NEWSLETTER_CAPTURE_TAG, NewsletterCaptureElement);
}

registerNewsletterCapture();

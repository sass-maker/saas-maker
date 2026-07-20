# SaaS Maker App Health for Go

Dependency-free `net/http` endpoint instrumentation for SaaS Maker.

```bash
go get github.com/sass-maker/saas-maker/packages/app-health-go@latest
```

```go
health := apphealth.New(os.Getenv("SAASMAKER_API_KEY"))
server := &http.Server{Addr: ":8080", Handler: health.Middleware(mux)}
```

The SDK asynchronously sends only method, a validated framework route template,
status class, duration, timestamp, runtime source, and optional release. It
never uses the concrete URL path as telemetry and never collects headers,
cookies, query values, bodies, user identity, logs, or stack traces.

Go 1.23+ standard `http.ServeMux` applications expose the matched template
automatically through `Request.Pattern`. Go 1.22 and third-party routers must
provide `WithRouteResolver`; requests without a trustworthy template are
dropped. The resolver must return a template such as `/users/:id`, never a raw
URL. Invalid configuration disables delivery and is reported through
`Stats().LastError`. Ingest redirects are refused so the project key remains on
the configured origin.

Full guide: <https://packages.sassmaker.com/sdk/app-health-go/>

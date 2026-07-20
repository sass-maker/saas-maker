---
title: "App Health for Go"
description: "Install the SaaS Maker App Health SDK in a Go net/http application."
---

> **Release status:** the module source is prepared but not yet tagged for
> installation. This command becomes active with the App Health production release.

The module supports Go 1.22+ with no external dependencies. Go 1.23+ standard
`http.ServeMux` applications provide matched route templates automatically;
Go 1.22 applications must configure a route resolver for non-root routes.

## 1. Install

```bash
go get github.com/sass-maker/saas-maker/packages/app-health-go@latest
```

Set the project API key in the service environment:

```bash
SAASMAKER_API_KEY=pk_your_project_key
```

Do not expose this server-side key to browser code or commit it to the
repository.

## 2. Wrap the HTTP handler

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	apphealth "github.com/sass-maker/saas-maker/packages/app-health-go"
)

func main() {
	apiKey := os.Getenv("SAASMAKER_API_KEY")
	if apiKey == "" {
		log.Fatal("SAASMAKER_API_KEY is required")
	}

	health := apphealth.New(
		apiKey,
		apphealth.WithRelease(os.Getenv("APP_RELEASE")),
	)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(r.PathValue("id")))
	})

	server := &http.Server{
		Addr:              ":8080",
		Handler:           health.Middleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	_ = health.Close(ctx)
}
```

`Middleware` records after the handler completes and queues the summary without
waiting for SaaS Maker. It preserves headers, status, body, flushing, hijacking,
HTTP/2 push, `io.ReaderFrom`, and panic propagation.

## 3. Verify

```bash
curl -i http://localhost:8080/health
curl -i 'http://localhost:8080/users/123456?email=private@example.com'
```

Open `https://app.sassmaker.com/fleet/app-health`, select the project, and use
**Last hour**. You should see `GET /health` and `GET /users/:id`. You must not
see `123456`, `email`, or the query value.

Go 1.23+ supplies the matched `Request.Pattern` directly. Go 1.22 cannot expose
that matched template, so configure a resolver. Third-party routers should use
the same resolver hook:

```go
health := apphealth.New(
	apiKey,
	apphealth.WithRouteResolver(func(r *http.Request) string {
		return routeTemplateFromYourRouter(r)
	}),
)
```

Return a template such as `/jobs/:id`, never a raw URL.

The SDK does not guess route identities from concrete URL paths. If no valid
framework pattern or resolver result exists, it drops that summary instead of
risking a path parameter, email, or opaque identifier. Invalid resolver or
pattern values are also dropped without falling back to the concrete path.

## Diagnostics

```go
stats := health.Stats()
log.Printf("app health queued=%d sent=%d dropped=%d failed=%d last_error=%q",
	stats.Queued,
	stats.Sent,
	stats.Dropped,
	stats.Failed,
	stats.LastError,
)
```

These counters are local and contain no request data. A delivery failure is
reported in diagnostics but never changes the application response.

## Optional configuration

```go
health := apphealth.New(
	apiKey,
	apphealth.WithRelease(os.Getenv("GIT_SHA")),
	apphealth.WithEnvironment("production"),
	apphealth.WithSurface("public-api"),
)
```

The defaults are recommended. Always call `Close` during graceful shutdown so
queued summaries receive a bounded flush opportunity.

Invalid options disable telemetry and appear in `Stats().LastError`; they do
not generate repeated invalid ingest requests. The SDK also refuses ingest
redirects so `X-Project-Key` is never forwarded to a different origin.

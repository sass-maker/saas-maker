package apphealth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func testConfig(now time.Time) Option {
	return func(config *config) {
		config.flushInterval = time.Hour
		config.timeout = time.Second
		config.maxRetries = 0
		config.now = func() time.Time { return now }
		ids := []string{"event-1", "trace-1", "event-2", "trace-2"}
		config.newID = func() string {
			id := ids[0]
			ids = ids[1:]
			return id
		}
	}
}

func TestFlushSendsKeyScopedPrivacySafeSpan(t *testing.T) {
	var captured struct {
		Header http.Header
		Body   map[string]any
	}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		captured.Header = request.Header.Clone()
		if err := json.NewDecoder(request.Body).Decode(&captured.Body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	client := New(
		"pk_test",
		WithIngestURL(server.URL),
		WithRelease("abc123"),
		WithRouteResolver(func(*http.Request) string { return "/users/:id" }),
		testConfig(now),
	)
	request := httptest.NewRequest(http.MethodGet, "/users/123456?token=secret", nil)
	recorder := httptest.NewRecorder()
	client.Middleware(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	})).ServeHTTP(recorder, request)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if got := captured.Header.Get("X-Project-Key"); got != "pk_test" {
		t.Fatalf("X-Project-Key = %q", got)
	}
	if _, exists := captured.Body["project_id"]; exists {
		t.Fatal("batch must not contain project_id")
	}
	spans := captured.Body["spans"].([]any)
	span := spans[0].(map[string]any)
	if got := span["route_template"]; got != "/users/:id" {
		t.Fatalf("route_template = %v", got)
	}
	if got := span["status_class"]; got != "2xx" {
		t.Fatalf("status_class = %v", got)
	}
	encoded, _ := json.Marshal(captured.Body)
	if contains(string(encoded), "secret") || contains(string(encoded), "123456") {
		t.Fatalf("payload leaked path/query value: %s", encoded)
	}
	if err := client.Close(ctx); err != nil {
		t.Fatalf("close: %v", err)
	}
}

func TestDeliveryFailureIsBoundedAndReported(t *testing.T) {
	var requests int
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests++
		writer.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	client := New("pk_test", WithIngestURL(server.URL), testConfig(time.Now()))
	client.enqueue(span{
		SchemaVersion: 1, IdempotencyKey: "one", Surface: "api", Environment: "production",
		Source: "server-runtime", ObservedAt: time.Now().UTC().Format(time.RFC3339), TraceID: "trace",
		Method: http.MethodGet, RouteTemplate: "/one", StatusClass: "2xx", SamplingRate: 1,
		Operations: []any{},
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1 for non-retryable 400", requests)
	}
	stats := client.Stats()
	if stats.Failed != 1 || stats.LastError == "" {
		t.Fatalf("stats = %+v", stats)
	}
	_ = client.Close(ctx)
}

func TestConcurrentCloseReturnsSameResult(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	client := New("pk_test", WithIngestURL(server.URL), testConfig(time.Now()))
	client.enqueue(span{
		SchemaVersion: 1, IdempotencyKey: "one", Surface: "api", Environment: "production",
		Source: "server-runtime", ObservedAt: time.Now().UTC().Format(time.RFC3339), TraceID: "trace",
		Method: http.MethodGet, RouteTemplate: "/one", StatusClass: "2xx", SamplingRate: 1,
		Operations: []any{},
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	var wait sync.WaitGroup
	errors := make(chan error, 8)
	for range 8 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			errors <- client.Close(ctx)
		}()
	}
	wait.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatalf("close: %v", err)
		}
	}
	if client.Stats().Sent != 1 {
		t.Fatalf("stats = %+v", client.Stats())
	}
}

func TestRedirectDoesNotForwardProjectKey(t *testing.T) {
	redirected := make(chan http.Header, 1)
	destination := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		redirected <- request.Header.Clone()
		writer.WriteHeader(http.StatusCreated)
	}))
	defer destination.Close()
	origin := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		http.Redirect(writer, request, destination.URL, http.StatusTemporaryRedirect)
	}))
	defer origin.Close()

	client := New("pk_test", WithIngestURL(origin.URL), testConfig(time.Now()))
	client.enqueue(testSpan("redirect"))
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	select {
	case headers := <-redirected:
		t.Fatalf("redirect destination received project key %q", headers.Get("X-Project-Key"))
	default:
	}
	if stats := client.Stats(); stats.Failed != 1 || stats.Sent != 0 {
		t.Fatalf("stats = %+v", stats)
	}
	_ = client.Close(ctx)
}

func TestCloseWaitsForAcceptedEnqueueBeforeFinalDrain(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	entered := make(chan struct{})
	release := make(chan struct{})
	client := New(
		"pk_test",
		WithIngestURL(server.URL),
		testConfig(time.Now()),
		func(config *config) {
			config.beforeEnqueue = func() {
				close(entered)
				<-release
			}
		},
	)
	enqueued := make(chan struct{})
	go func() {
		client.enqueue(testSpan("shutdown"))
		close(enqueued)
	}()
	<-entered

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	closed := make(chan error, 1)
	go func() { closed <- client.Close(ctx) }()
	select {
	case err := <-closed:
		t.Fatalf("Close returned before accepted enqueue completed: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	close(release)
	<-enqueued
	if err := <-closed; err != nil {
		t.Fatalf("close: %v", err)
	}
	if stats := client.Stats(); stats.Sent != 1 || stats.Queued != 0 {
		t.Fatalf("accepted event was not drained: %+v", stats)
	}
}

func TestInvalidOptionsDisableDelivery(t *testing.T) {
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	tests := []struct {
		name    string
		key     string
		options []Option
	}{
		{name: "empty key", options: []Option{WithIngestURL(server.URL)}},
		{name: "empty surface", key: "pk_test", options: []Option{WithIngestURL(server.URL), WithSurface("")}},
		{name: "invalid environment", key: "pk_test", options: []Option{WithIngestURL(server.URL), WithEnvironment("qa")}},
		{name: "invalid ingest URL", key: "pk_test", options: []Option{WithIngestURL("://invalid")}},
		{name: "insecure remote ingest URL", key: "pk_test", options: []Option{WithIngestURL("http://example.com/spans")}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			options := append(test.options, WithRouteResolver(func(*http.Request) string { return "/health" }))
			client := New(test.key, options...)
			handler := client.Middleware(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(http.StatusOK)
			}))
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/health", nil))
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			if err := client.Flush(ctx); err != nil {
				t.Fatalf("flush: %v", err)
			}
			if stats := client.Stats(); stats.LastError == "" || stats.Dropped != 1 {
				t.Fatalf("invalid configuration was not surfaced safely: %+v", stats)
			}
			_ = client.Close(ctx)
		})
	}
	if got := requests.Load(); got != 0 {
		t.Fatalf("invalid clients made %d ingest requests", got)
	}
}

func testSpan(id string) span {
	return span{
		SchemaVersion: 1, IdempotencyKey: id, Surface: "api", Environment: "production",
		Source: "server-runtime", ObservedAt: time.Now().UTC().Format(time.RFC3339), TraceID: "trace-" + id,
		Method: http.MethodGet, RouteTemplate: "/" + id, StatusClass: "2xx", SamplingRate: 1,
		Operations: []any{},
	}
}

func contains(value, substring string) bool {
	for index := 0; index+len(substring) <= len(value); index++ {
		if value[index:index+len(substring)] == substring {
			return true
		}
	}
	return false
}

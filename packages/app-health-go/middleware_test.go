package apphealth

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestMiddlewarePreservesResponseAndServeMuxPattern(t *testing.T) {
	var captured batch
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if err := json.NewDecoder(request.Body).Decode(&captured); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	client := New("pk_test", WithIngestURL(server.URL), testConfig(time.Now()))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /users/{id}", func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("X-Test", "yes")
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write([]byte("accepted"))
	})
	recorder := httptest.NewRecorder()
	client.Middleware(mux).ServeHTTP(
		recorder,
		httptest.NewRequest(http.MethodGet, "/users/123456?private=yes", nil),
	)
	if recorder.Code != http.StatusAccepted || recorder.Body.String() != "accepted" {
		t.Fatalf("response = %d %q", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("X-Test") != "yes" {
		t.Fatal("response header not preserved")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(captured.Spans) != 1 || captured.Spans[0].RouteTemplate != "/users/:id" {
		t.Fatalf("spans = %+v", captured.Spans)
	}
	if captured.Spans[0].StatusClass != "2xx" {
		t.Fatalf("status = %q", captured.Spans[0].StatusClass)
	}
	_ = client.Close(ctx)
}

func TestMiddlewareRepanicsAfterRecordingFiveHundred(t *testing.T) {
	var captured batch
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if err := json.NewDecoder(request.Body).Decode(&captured); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	client := New(
		"pk_test",
		WithIngestURL(server.URL),
		WithRouteResolver(func(*http.Request) string { return "/panic" }),
		testConfig(time.Now()),
	)
	handler := client.Middleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))
	func() {
		defer func() {
			if recovered := recover(); recovered != "boom" {
				t.Fatalf("panic = %v", recovered)
			}
		}()
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/raw/1234", nil))
	}()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(captured.Spans) != 1 || captured.Spans[0].StatusClass != "5xx" || captured.Spans[0].RouteTemplate != "/panic" {
		t.Fatalf("spans = %+v", captured.Spans)
	}
	_ = client.Close(ctx)
}

func TestNormalizeRouteBoundsAndDynamicSegments(t *testing.T) {
	if got := normalizeRoute("/orders/123456"); got != "/orders/:id" {
		t.Fatalf("normalizeRoute numeric = %q", got)
	}
	if got := normalizeRoute("/items/01965b0c-7d8f-7abc-8def-1234567890ab"); got != "/items/:id" {
		t.Fatalf("normalizeRoute uuid = %q", got)
	}
	tooLong := "/"
	for len(tooLong) <= maxRouteLength {
		tooLong += "x"
	}
	if got := normalizeRoute(tooLong); got != "" {
		t.Fatalf("oversized route = %q", got)
	}
	if got := normalizeRoute("/users/alice@example.com"); got != "" {
		t.Fatalf("email-like route = %q", got)
	}
	if got := normalizeRoute("/orders/123456?email=private"); got != "" {
		t.Fatalf("route containing query = %q", got)
	}
}

func TestMiddlewareDropsConcretePathWithoutTemplate(t *testing.T) {
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		writer.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()
	client := New("pk_test", WithIngestURL(server.URL), testConfig(time.Now()))
	handler := client.Middleware(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	for _, path := range []string{"/users/alice@example.com", "/users/opaque-customer-token"} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if got := requests.Load(); got != 0 {
		t.Fatalf("concrete private paths produced %d ingest requests", got)
	}
	_ = client.Close(ctx)
}

func TestResolverValidationDoesNotFallBackToConcretePath(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/safe-looking-fallback", nil)
	tests := []struct {
		name     string
		resolved string
		want     string
	}{
		{name: "template", resolved: "/users/:id", want: "/users/:id"},
		{name: "email", resolved: "/users/alice@example.com"},
		{name: "query", resolved: "/users/:id?private=yes"},
		{name: "oversized", resolved: "/" + string(bytes.Repeat([]byte("x"), maxRouteLength))},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			client := &Client{cfg: config{resolver: func(*http.Request) string { return test.resolved }}}
			if got := client.resolveRoute(request); got != test.want {
				t.Fatalf("resolveRoute = %q, want %q", got, test.want)
			}
		})
	}
}

func TestMiddlewarePreservesExactOptionalInterfaceSet(t *testing.T) {
	tests := []struct {
		name       string
		writer     http.ResponseWriter
		flusher    bool
		hijacker   bool
		pusher     bool
		readerFrom bool
	}{
		{name: "none", writer: newBareWriter()},
		{name: "flusher only", writer: &flusherWriter{bareWriter: newBareWriter()}, flusher: true},
		{
			name: "all", writer: &allOptionalWriter{bareWriter: newBareWriter()},
			flusher: true, hijacker: true, pusher: true, readerFrom: true,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			client := New("pk_test", testConfig(time.Now()))
			handler := client.Middleware(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				_, gotFlusher := writer.(http.Flusher)
				_, gotHijacker := writer.(http.Hijacker)
				_, gotPusher := writer.(http.Pusher)
				_, gotReaderFrom := writer.(io.ReaderFrom)
				if gotFlusher != test.flusher || gotHijacker != test.hijacker || gotPusher != test.pusher || gotReaderFrom != test.readerFrom {
					t.Fatalf("optional interfaces = flusher:%t hijacker:%t pusher:%t readerFrom:%t", gotFlusher, gotHijacker, gotPusher, gotReaderFrom)
				}
				writer.WriteHeader(http.StatusNoContent)
			}))
			handler.ServeHTTP(test.writer, httptest.NewRequest(http.MethodGet, "/unmatched", nil))
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			if err := client.Close(ctx); err != nil {
				t.Fatalf("close: %v", err)
			}
		})
	}
}

type bareWriter struct {
	header http.Header
	body   bytes.Buffer
	status int
}

func newBareWriter() *bareWriter                  { return &bareWriter{header: make(http.Header)} }
func (writer *bareWriter) Header() http.Header    { return writer.header }
func (writer *bareWriter) WriteHeader(status int) { writer.status = status }
func (writer *bareWriter) Write(body []byte) (int, error) {
	if writer.status == 0 {
		writer.status = http.StatusOK
	}
	return writer.body.Write(body)
}

type flusherWriter struct{ *bareWriter }

func (*flusherWriter) Flush() {}

type allOptionalWriter struct{ *bareWriter }

func (*allOptionalWriter) Flush() {}
func (*allOptionalWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return nil, nil, http.ErrNotSupported
}
func (*allOptionalWriter) Push(string, *http.PushOptions) error { return nil }
func (writer *allOptionalWriter) ReadFrom(source io.Reader) (int64, error) {
	if writer.status == 0 {
		writer.status = http.StatusOK
	}
	return writer.body.ReadFrom(source)
}

package apphealth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	defaultIngestURL     = "https://api.sassmaker.com/v1/performance/spans"
	defaultQueueSize     = 1024
	defaultBatchSize     = 50
	defaultFlushInterval = 5 * time.Second
	defaultTimeout       = 3 * time.Second
	defaultMaxRetries    = 2
	defaultBaseBackoff   = 200 * time.Millisecond
	maxBatchSize         = 50
)

type span struct {
	SchemaVersion  int     `json:"schema_version"`
	IdempotencyKey string  `json:"idempotency_key"`
	Surface        string  `json:"surface"`
	Environment    string  `json:"environment"`
	Source         string  `json:"source"`
	Revision       string  `json:"revision,omitempty"`
	ObservedAt     string  `json:"observed_at"`
	TraceID        string  `json:"trace_id"`
	Method         string  `json:"method"`
	RouteTemplate  string  `json:"route_template"`
	StatusClass    string  `json:"status_class"`
	DurationMS     float64 `json:"duration_ms"`
	SamplingRate   float64 `json:"sampling_rate"`
	Operations     []any   `json:"operations"`
}

type batch struct {
	Spans []span `json:"spans"`
}

// RouteResolver returns a framework route template for a request. Return an
// empty string to use Request.Pattern (Go 1.23+) or conservative path
// normalization.
type RouteResolver func(*http.Request) string

// Option customizes a Client. New(apiKey) is the recommended minimal setup.
type Option func(*config)

type config struct {
	ingestURL     string
	release       string
	surface       string
	environment   string
	queueSize     int
	batchSize     int
	flushInterval time.Duration
	timeout       time.Duration
	maxRetries    int
	baseBackoff   time.Duration
	httpClient    *http.Client
	resolver      RouteResolver
	now           func() time.Time
	newID         func() string
	beforeEnqueue func()
}

func defaultConfig() config {
	return config{
		ingestURL:     defaultIngestURL,
		surface:       "api",
		environment:   "production",
		queueSize:     defaultQueueSize,
		batchSize:     defaultBatchSize,
		flushInterval: defaultFlushInterval,
		timeout:       defaultTimeout,
		maxRetries:    defaultMaxRetries,
		baseBackoff:   defaultBaseBackoff,
		now:           time.Now,
		newID:         newEventID,
	}
}

func WithRelease(release string) Option {
	return func(c *config) { c.release = boundedLabel(release, 80) }
}
func WithSurface(surface string) Option {
	return func(c *config) { c.surface = boundedLabel(surface, 160) }
}
func WithEnvironment(environment string) Option {
	return func(c *config) { c.environment = boundedLabel(environment, 32) }
}
func WithRouteResolver(resolver RouteResolver) Option {
	return func(c *config) { c.resolver = resolver }
}
func WithIngestURL(url string) Option           { return func(c *config) { c.ingestURL = url } }
func WithHTTPClient(client *http.Client) Option { return func(c *config) { c.httpClient = client } }

// Client owns the bounded asynchronous App Health delivery pipeline.
type Client struct {
	apiKey string
	cfg    config
	queue  chan span
	flush  chan chan struct{}
	stop   chan struct{}
	done   chan struct{}

	httpClient *http.Client
	disabled   bool
	closed     atomic.Bool
	closeOnce  sync.Once
	closeErr   error
	enqueueMu  sync.RWMutex

	dropped     atomic.Int64
	sent        atomic.Int64
	failed      atomic.Int64
	retries     atomic.Int64
	batchesSent atomic.Int64
	lastError   atomic.Value
}

// Stats is a local diagnostic snapshot. It contains counters only, never
// request data.
type Stats struct {
	Queued      int
	Dropped     int64
	Sent        int64
	Failed      int64
	Retries     int64
	BatchesSent int64
	LastError   string
}

// New starts an App Health client. apiKey is the only required setting.
func New(apiKey string, options ...Option) *Client {
	cfg := defaultConfig()
	for _, option := range options {
		if option != nil {
			option(&cfg)
		}
	}
	if cfg.queueSize <= 0 {
		cfg.queueSize = defaultQueueSize
	}
	if cfg.batchSize <= 0 || cfg.batchSize > maxBatchSize {
		cfg.batchSize = defaultBatchSize
	}
	if cfg.flushInterval <= 0 {
		cfg.flushInterval = defaultFlushInterval
	}
	if cfg.timeout <= 0 {
		cfg.timeout = defaultTimeout
	}
	if cfg.maxRetries < 0 {
		cfg.maxRetries = 0
	}
	if cfg.baseBackoff < 0 {
		cfg.baseBackoff = 0
	}
	configErr := validateConfig(apiKey, cfg)
	httpClient := cfg.httpClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: cfg.timeout}
	}
	// Never follow redirects carrying the project key. Clone an injected client
	// so its caller-owned configuration is not mutated.
	clonedHTTPClient := *httpClient
	clonedHTTPClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	client := &Client{
		apiKey:     apiKey,
		cfg:        cfg,
		queue:      make(chan span, cfg.queueSize),
		flush:      make(chan chan struct{}),
		stop:       make(chan struct{}),
		done:       make(chan struct{}),
		httpClient: &clonedHTTPClient,
		disabled:   configErr != nil,
	}
	if configErr != nil {
		client.lastError.Store(configErr.Error())
	} else {
		client.lastError.Store("")
	}
	go client.loop()
	return client
}

func (c *Client) enqueue(value span) {
	c.enqueueMu.RLock()
	defer c.enqueueMu.RUnlock()
	if c.disabled {
		c.dropped.Add(1)
		return
	}
	if c.closed.Load() {
		c.dropped.Add(1)
		return
	}
	if c.cfg.beforeEnqueue != nil {
		c.cfg.beforeEnqueue()
	}
	select {
	case c.queue <- value:
	default:
		c.dropped.Add(1)
	}
}

func (c *Client) loop() {
	defer close(c.done)
	timer := time.NewTimer(c.cfg.flushInterval)
	defer timer.Stop()
	items := make([]span, 0, c.cfg.batchSize)

	deliver := func() {
		if len(items) == 0 {
			return
		}
		c.deliver(items)
		items = items[:0]
	}
	drain := func() {
		for {
			select {
			case item := <-c.queue:
				items = append(items, item)
				if len(items) >= c.cfg.batchSize {
					deliver()
				}
			default:
				deliver()
				return
			}
		}
	}

	for {
		select {
		case <-c.stop:
			drain()
			return
		case item := <-c.queue:
			items = append(items, item)
			if len(items) >= c.cfg.batchSize {
				deliver()
				resetTimer(timer, c.cfg.flushInterval)
			}
		case <-timer.C:
			deliver()
			timer.Reset(c.cfg.flushInterval)
		case acknowledgement := <-c.flush:
			drain()
			close(acknowledgement)
		}
	}
}

func resetTimer(timer *time.Timer, duration time.Duration) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(duration)
}

func (c *Client) deliver(items []span) {
	body, err := json.Marshal(batch{Spans: append([]span(nil), items...)})
	if err != nil {
		c.failed.Add(int64(len(items)))
		c.lastError.Store(err.Error())
		return
	}
	lastError := "delivery failed"
	for attempt := 0; attempt <= c.cfg.maxRetries; attempt++ {
		if attempt > 0 {
			c.retries.Add(1)
			time.Sleep(minDuration(c.cfg.baseBackoff<<(attempt-1), c.cfg.baseBackoff*8))
		}
		status, sendErr := c.send(body)
		if sendErr == nil && status >= 200 && status < 300 {
			c.sent.Add(int64(len(items)))
			c.batchesSent.Add(1)
			c.lastError.Store("")
			return
		}
		if sendErr != nil {
			lastError = sendErr.Error()
		} else {
			lastError = fmt.Sprintf("ingest responded %d", status)
			if status != http.StatusTooManyRequests && status < 500 {
				break
			}
		}
	}
	c.failed.Add(int64(len(items)))
	c.lastError.Store(lastError)
}

func minDuration(left, right time.Duration) time.Duration {
	if left < right {
		return left
	}
	return right
}

func (c *Client) send(body []byte) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), c.cfg.timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.ingestURL, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Project-Key", c.apiKey)
	request.Header.Set("User-Agent", "saas-maker-app-health-go/0.1")
	response, err := c.httpClient.Do(request)
	if err != nil {
		return 0, err
	}
	_, _ = io.Copy(io.Discard, response.Body)
	_ = response.Body.Close()
	return response.StatusCode, nil
}

// Flush waits until all currently queued summaries have been delivered.
func (c *Client) Flush(ctx context.Context) error {
	if c.closed.Load() {
		return errors.New("apphealth: client closed")
	}
	acknowledgement := make(chan struct{})
	select {
	case c.flush <- acknowledgement:
	case <-c.done:
		return errors.New("apphealth: client closed")
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case <-acknowledgement:
		return nil
	case <-c.done:
		return errors.New("apphealth: client closed")
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Close stops accepting new summaries, drains the queue, and waits for the
// delivery goroutine within ctx.
func (c *Client) Close(ctx context.Context) error {
	c.closeOnce.Do(func() {
		c.enqueueMu.Lock()
		c.closed.Store(true)
		close(c.stop)
		c.enqueueMu.Unlock()
		select {
		case <-c.done:
		case <-ctx.Done():
			c.closeErr = fmt.Errorf("apphealth: close timed out: %w", ctx.Err())
		}
	})
	return c.closeErr
}

func validateConfig(apiKey string, cfg config) error {
	if strings.TrimSpace(apiKey) == "" || apiKey != strings.TrimSpace(apiKey) || containsControl(apiKey) {
		return errors.New("apphealth: project key must be a non-empty header-safe value")
	}
	if cfg.surface == "" || len(cfg.surface) > 160 || containsControl(cfg.surface) {
		return errors.New("apphealth: surface must be a non-empty label of at most 160 characters")
	}
	switch cfg.environment {
	case "production", "staging", "preview", "development", "local":
	default:
		return errors.New("apphealth: environment must be production, staging, preview, development, or local")
	}
	parsed, err := url.Parse(cfg.ingestURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("apphealth: ingest URL must be an absolute HTTP or HTTPS URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("apphealth: ingest URL must not contain credentials, query parameters, or a fragment")
	}
	host := parsed.Hostname()
	address := net.ParseIP(host)
	loopback := host == "localhost" || (address != nil && address.IsLoopback())
	if parsed.Scheme == "http" && !loopback {
		return errors.New("apphealth: ingest URL must use HTTPS unless it targets loopback")
	}
	return nil
}

func containsControl(value string) bool {
	for _, character := range value {
		if character <= 31 || character == 127 {
			return true
		}
	}
	return false
}

func (c *Client) Stats() Stats {
	lastError, _ := c.lastError.Load().(string)
	return Stats{
		Queued:      len(c.queue),
		Dropped:     c.dropped.Load(),
		Sent:        c.sent.Load(),
		Failed:      c.failed.Load(),
		Retries:     c.retries.Load(),
		BatchesSent: c.batchesSent.Load(),
		LastError:   lastError,
	}
}

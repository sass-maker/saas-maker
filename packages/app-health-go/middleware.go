package apphealth

import (
	"io"
	"net/http"
	"strings"
	"time"
)

// Middleware records one privacy-bounded endpoint summary after each request.
// It preserves response behavior and re-panics after recording a 5xx class.
func (c *Client) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		startedAt := c.cfg.now()
		wrapped := &responseWriter{ResponseWriter: writer}
		defer func() {
			duration := c.cfg.now().Sub(startedAt)
			if recovered := recover(); recovered != nil {
				wrapped.status = http.StatusInternalServerError
				wrapped.wroteHeader = true
				c.record(request, startedAt, duration, wrapped.status)
				panic(recovered)
			}
			wrapped.finish()
			c.record(request, startedAt, duration, wrapped.status)
		}()
		next.ServeHTTP(withOptionalInterfaces(wrapped, writer), request)
	})
}

func (c *Client) record(request *http.Request, startedAt time.Time, duration time.Duration, status int) {
	route := c.resolveRoute(request)
	if route == "" {
		return
	}
	method := strings.ToUpper(strings.TrimSpace(request.Method))
	if method == "" {
		method = http.MethodGet
	}
	if len(method) > 12 {
		method = method[:12]
	}
	if status < 100 || status > 599 {
		status = http.StatusOK
	}
	durationMS := float64(duration) / float64(time.Millisecond)
	if durationMS < 0 {
		durationMS = 0
	}
	c.enqueue(span{
		SchemaVersion:  1,
		IdempotencyKey: c.cfg.newID(),
		Surface:        c.cfg.surface,
		Environment:    c.cfg.environment,
		Source:         "server-runtime",
		Revision:       c.cfg.release,
		ObservedAt:     startedAt.UTC().Format(time.RFC3339Nano),
		TraceID:        c.cfg.newID(),
		Method:         method,
		RouteTemplate:  route,
		StatusClass:    string(rune('0'+status/100)) + "xx",
		DurationMS:     durationMS,
		SamplingRate:   1,
		Operations:     []any{},
	})
}

func (c *Client) resolveRoute(request *http.Request) string {
	if c.cfg.resolver != nil {
		resolved := strings.TrimSpace(c.cfg.resolver(request))
		if resolved != "" {
			// A resolver that returned a route chose the identity source. If it is
			// invalid, drop it rather than falling back to the concrete URL.
			return normalizeRoute(resolved)
		}
	}
	if pattern := requestPattern(request); pattern != "" {
		// Likewise, never turn an invalid or oversized matched pattern into a
		// raw concrete-path fallback.
		return patternRoute(pattern)
	}
	// Without a framework template there is no reliable way to distinguish a
	// static segment from a username or opaque identifier. Root is the sole
	// unambiguous concrete route; Go 1.22 callers need a RouteResolver for all
	// other routes.
	if request.URL.Path == "/" {
		return "/"
	}
	return ""
}

type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (writer *responseWriter) WriteHeader(status int) {
	if writer.wroteHeader {
		return
	}
	writer.status = status
	writer.wroteHeader = true
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *responseWriter) Write(body []byte) (int, error) {
	if !writer.wroteHeader {
		writer.status = http.StatusOK
		writer.wroteHeader = true
	}
	return writer.ResponseWriter.Write(body)
}

func (writer *responseWriter) finish() {
	if !writer.wroteHeader {
		writer.status = http.StatusOK
		writer.wroteHeader = true
	}
}

// Unwrap lets http.ResponseController reach the original writer.
func (writer *responseWriter) Unwrap() http.ResponseWriter {
	return writer.ResponseWriter
}

// withOptionalInterfaces exposes exactly the optional interfaces implemented
// by the original writer. Anonymous interface embedding keeps this local and
// dependency-free while covering every combination.
func withOptionalInterfaces(core *responseWriter, original http.ResponseWriter) http.ResponseWriter {
	flusher, hasFlusher := original.(http.Flusher)
	hijacker, hasHijacker := original.(http.Hijacker)
	pusher, hasPusher := original.(http.Pusher)
	readerFrom, hasReaderFrom := original.(io.ReaderFrom)
	if hasFlusher {
		flusher = flusherDelegate{core: core, original: flusher}
	}
	if hasReaderFrom {
		readerFrom = readerFromDelegate{core: core, original: readerFrom}
	}
	mask := 0
	if hasFlusher {
		mask |= 1
	}
	if hasHijacker {
		mask |= 2
	}
	if hasPusher {
		mask |= 4
	}
	if hasReaderFrom {
		mask |= 8
	}
	switch mask {
	case 1:
		return struct {
			*responseWriter
			http.Flusher
		}{core, flusher}
	case 2:
		return struct {
			*responseWriter
			http.Hijacker
		}{core, hijacker}
	case 3:
		return struct {
			*responseWriter
			http.Flusher
			http.Hijacker
		}{core, flusher, hijacker}
	case 4:
		return struct {
			*responseWriter
			http.Pusher
		}{core, pusher}
	case 5:
		return struct {
			*responseWriter
			http.Flusher
			http.Pusher
		}{core, flusher, pusher}
	case 6:
		return struct {
			*responseWriter
			http.Hijacker
			http.Pusher
		}{core, hijacker, pusher}
	case 7:
		return struct {
			*responseWriter
			http.Flusher
			http.Hijacker
			http.Pusher
		}{core, flusher, hijacker, pusher}
	case 8:
		return struct {
			*responseWriter
			io.ReaderFrom
		}{core, readerFrom}
	case 9:
		return struct {
			*responseWriter
			http.Flusher
			io.ReaderFrom
		}{core, flusher, readerFrom}
	case 10:
		return struct {
			*responseWriter
			http.Hijacker
			io.ReaderFrom
		}{core, hijacker, readerFrom}
	case 11:
		return struct {
			*responseWriter
			http.Flusher
			http.Hijacker
			io.ReaderFrom
		}{core, flusher, hijacker, readerFrom}
	case 12:
		return struct {
			*responseWriter
			http.Pusher
			io.ReaderFrom
		}{core, pusher, readerFrom}
	case 13:
		return struct {
			*responseWriter
			http.Flusher
			http.Pusher
			io.ReaderFrom
		}{core, flusher, pusher, readerFrom}
	case 14:
		return struct {
			*responseWriter
			http.Hijacker
			http.Pusher
			io.ReaderFrom
		}{core, hijacker, pusher, readerFrom}
	case 15:
		return struct {
			*responseWriter
			http.Flusher
			http.Hijacker
			http.Pusher
			io.ReaderFrom
		}{core, flusher, hijacker, pusher, readerFrom}
	default:
		return core
	}
}

type flusherDelegate struct {
	core     *responseWriter
	original http.Flusher
}

func (delegate flusherDelegate) Flush() {
	if !delegate.core.wroteHeader {
		delegate.core.status = http.StatusOK
		delegate.core.wroteHeader = true
	}
	delegate.original.Flush()
}

type readerFromDelegate struct {
	core     *responseWriter
	original io.ReaderFrom
}

func (delegate readerFromDelegate) ReadFrom(source io.Reader) (int64, error) {
	if !delegate.core.wroteHeader {
		delegate.core.status = http.StatusOK
		delegate.core.wroteHeader = true
	}
	return delegate.original.ReadFrom(source)
}

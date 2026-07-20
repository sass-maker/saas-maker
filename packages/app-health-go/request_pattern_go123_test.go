//go:build go1.23

package apphealth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInvalidRequestPatternDoesNotFallBackToConcretePath(t *testing.T) {
	tests := []struct {
		name    string
		pattern string
	}{
		{name: "email", pattern: "GET /users/alice@example.com"},
		{name: "query", pattern: "GET /users/{id}?private=yes"},
		{name: "oversized", pattern: "GET /" + strings.Repeat("x", maxRouteLength)},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/safe-looking-fallback", nil)
			request.Pattern = test.pattern
			if got := (&Client{}).resolveRoute(request); got != "" {
				t.Fatalf("resolveRoute = %q, want dropped pattern", got)
			}
		})
	}
}

//go:build go1.23

package apphealth

import "net/http"

func requestPattern(request *http.Request) string { return request.Pattern }

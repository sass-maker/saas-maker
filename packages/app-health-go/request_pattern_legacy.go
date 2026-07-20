//go:build !go1.23

package apphealth

import "net/http"

func requestPattern(_ *http.Request) string { return "" }

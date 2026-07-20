package apphealth

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
)

const maxRouteLength = 200

var (
	numericSegment = regexp.MustCompile(`^\d+$`)
	uuidSegment    = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f-]{27,}$`)
	hexSegment     = regexp.MustCompile(`(?i)^[0-9a-f]{8,}$`)
)

func normalizeRoute(value string) string {
	if strings.ContainsAny(value, "?#") {
		return ""
	}
	value = strings.TrimSpace(value)
	if !strings.HasPrefix(value, "/") {
		return ""
	}
	parts := strings.Split(value, "/")
	for index, part := range parts {
		if part == "" || strings.HasPrefix(part, ":") || (strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}")) {
			continue
		}
		if strings.ContainsAny(part, "@%=") {
			return ""
		}
		if numericSegment.MatchString(part) || uuidSegment.MatchString(part) || hexSegment.MatchString(part) {
			parts[index] = ":id"
		}
	}
	normalized := strings.Join(parts, "/")
	if len(normalized) == 0 || len(normalized) > maxRouteLength {
		return ""
	}
	return normalized
}

func patternRoute(pattern string) string {
	pattern = strings.TrimSpace(pattern)
	if index := strings.IndexByte(pattern, ' '); index >= 0 {
		pattern = strings.TrimSpace(pattern[index+1:])
	}
	if !strings.HasPrefix(pattern, "/") {
		if index := strings.IndexByte(pattern, '/'); index >= 0 {
			pattern = pattern[index:]
		}
	}
	parts := strings.Split(pattern, "/")
	for index, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			name := strings.TrimSuffix(strings.TrimSuffix(strings.TrimPrefix(part, "{"), "}"), "...")
			if name == "$" || name == "" {
				parts[index] = ""
			} else {
				parts[index] = ":" + name
			}
		}
	}
	return normalizeRoute(strings.Join(parts, "/"))
}

func boundedLabel(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) > max {
		return value[:max]
	}
	return value
}

func newEventID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return hex.EncodeToString([]byte("apphealth-fallback"))[:32]
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	encoded := hex.EncodeToString(bytes[:])
	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32]
}

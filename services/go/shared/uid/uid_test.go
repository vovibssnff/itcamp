package uid

import (
	"regexp"
	"testing"
)

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestNew_ValidUUIDv4(t *testing.T) {
	for i := 0; i < 100; i++ {
		got := New()
		if !uuidRe.MatchString(got) {
			t.Fatalf("invalid uuid %q", got)
		}
	}
}

func TestNew_Unique(t *testing.T) {
	seen := make(map[string]struct{}, 1000)
	for i := 0; i < 1000; i++ {
		u := New()
		if _, ok := seen[u]; ok {
			t.Fatalf("duplicate uuid %q", u)
		}
		seen[u] = struct{}{}
	}
}

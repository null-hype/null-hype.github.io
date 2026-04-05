package test

import (
	"crypto/rand"
	"encoding/hex"
	"os"
)

// randomSuffix generates a 6-character lowercase hex string for use in
// ephemeral resource names (e.g. "tidelane-test-a3f9c1").
func randomSuffix() string {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// preserveOnFailure reports whether the caller has opted into keeping test
// resources alive after a test failure for manual inspection.
func preserveOnFailure() bool {
	return os.Getenv("PRESERVE_ON_FAILURE") == "1"
}

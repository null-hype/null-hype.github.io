package test

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"
)

// randomSuffix generates a 6-character hex suffix for ephemeral resource names.
func randomSuffix() string {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// preserveOnFailure checks whether the caller requested resource preservation.
func preserveOnFailure() bool {
	return os.Getenv("PRESERVE_ON_FAILURE") == "1"
}

// TestGCEInstancePlan validates that terraform plan produces a valid plan for
// an ephemeral instance without applying it.
//
// TODO(PLAN-185): implement full Terratest suite
func TestGCEInstancePlan(t *testing.T) {
	t.Skip("not yet implemented — placeholder for PLAN-185")

	suffix := randomSuffix()
	instanceName := "tidelane-test-" + suffix
	t.Logf("ephemeral instance name: %s", instanceName)

	if preserveOnFailure() {
		t.Log("PRESERVE_ON_FAILURE=1: test resources will be kept if this run fails")
	}
}

package test

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// requiredEnv reads an environment variable and fails the test if absent.
func requiredEnv(t *testing.T, key string) string {
	t.Helper()
	v := os.Getenv(key)
	if v == "" {
		t.Fatalf("required environment variable %s is not set", key)
	}
	return v
}

// tfOptions returns a base terraform.Options pointed at infra/terraform.
// instanceName is set so test runs use an ephemeral name.
func tfOptions(t *testing.T, instanceName string) *terraform.Options {
	t.Helper()

	gcpProject := requiredEnv(t, "GCP_PROJECT")
	cfZoneID := requiredEnv(t, "CLOUDFLARE_ZONE_ID")

	return terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: "../terraform",
		Vars: map[string]interface{}{
			"gcp_project_id":      gcpProject,
			"instance_name":       instanceName,
			"machine_type":        "e2-micro",
			"cloudflare_zone_id":  cfZoneID,
			"env":                 "test",
		},
		// Secrets come in via environment variables; Terraform reads
		// GOOGLE_CREDENTIALS and CLOUDFLARE_API_TOKEN from the environment.
		// TF_VAR_ssh_public_key is injected by the Dagger check function.
		NoColor: true,
	})
}

// TestTerraformValidate runs `terraform validate` — no credentials required.
// This is the cheapest gate: catches syntax errors and missing variable
// declarations before any network calls.
func TestTerraformValidate(t *testing.T) {
	t.Parallel()

	opts := &terraform.Options{
		TerraformDir: "../terraform",
		NoColor:      true,
	}

	terraform.InitAndValidate(t, opts)
}

// TestTerraformPlan runs a full plan against an ephemeral instance name and
// asserts the plan JSON contains the expected resource types.
// Requires GOOGLE_CREDENTIALS, CLOUDFLARE_API_TOKEN, GCP_PROJECT, CLOUDFLARE_ZONE_ID.
// Does NOT create any real infrastructure.
func TestTerraformPlan(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping plan test in short mode")
	}

	suffix := randomSuffix()
	instanceName := "tidelane-test-" + suffix
	t.Logf("ephemeral instance name for plan: %s", instanceName)

	opts := tfOptions(t, instanceName)
	// InitAndPlanAndShowWithStructNoLogTempPlanFile avoids leaving plan files on disk.
	planStruct := terraform.InitAndPlanAndShowWithStructNoLogTempPlanFile(t, opts)

	// Assert expected resource types appear in the plan.
	resourceTypes := planResourceTypes(planStruct)
	assert.Contains(t, resourceTypes, "google_compute_instance",
		"plan should include a GCE instance")
	assert.Contains(t, resourceTypes, "google_compute_firewall",
		"plan should include firewall rules")
	assert.Contains(t, resourceTypes, "cloudflare_record",
		"plan should include Cloudflare DNS records")
	assert.Contains(t, resourceTypes, "cloudflare_zone_settings_override",
		"plan should include Cloudflare zone TLS settings")

	// Assert Cloudflare record names (apex and wildcard) without creating real DNS.
	records := planCloudflareRecordNames(planStruct)
	assert.Contains(t, records, "@", "plan should include apex A record")
	assert.Contains(t, records, "*", "plan should include wildcard A record")
}

// TestGCEInstanceApply creates a real ephemeral GCE instance, asserts on outputs,
// then destroys it. This is the full mutating check path.
// Skipped with -short. Requires all credentials and a real GCP project.
func TestGCEInstanceApply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping apply test in short mode")
	}

	suffix := randomSuffix()
	instanceName := "tidelane-test-" + suffix
	t.Logf("provisioning ephemeral instance: %s", instanceName)

	opts := tfOptions(t, instanceName)

	// Teardown: always destroy unless PRESERVE_ON_FAILURE=1 and the test failed.
	defer func() {
		if t.Failed() && preserveOnFailure() {
			t.Logf("PRESERVE_ON_FAILURE=1: skipping destroy. Clean up manually:")
			t.Logf("  cd infra/terraform && terraform destroy -var=instance_name=%s", instanceName)
			return
		}
		terraform.Destroy(t, opts)
	}()

	terraform.InitAndApply(t, opts)

	// --- Output assertions ---

	ipv4 := terraform.Output(t, opts, "instance_ipv4")
	require.NotEmpty(t, ipv4, "instance_ipv4 output must not be empty")
	t.Logf("instance_ipv4: %s", ipv4)

	name := terraform.Output(t, opts, "instance_name")
	assert.Equal(t, instanceName, name, "instance_name output must match the provisioned name")

	zone := terraform.Output(t, opts, "instance_zone")
	require.NotEmpty(t, zone, "instance_zone output must not be empty")

	sshUser := terraform.Output(t, opts, "ssh_user")
	assert.Equal(t, "smallweb", sshUser)

	sshConn := terraform.Output(t, opts, "ssh_connection")
	assert.Equal(t, fmt.Sprintf("smallweb@%s", ipv4), sshConn,
		"ssh_connection should be user@ipv4")

	selfLink := terraform.Output(t, opts, "instance_self_link")
	assert.True(t, strings.HasPrefix(selfLink, "https://www.googleapis.com/compute/"),
		"instance_self_link should be a GCE API URL")
}

// planResourceTypes extracts the set of resource type strings from a plan struct.
func planResourceTypes(plan *terraform.PlanStruct) []string {
	seen := map[string]bool{}
	var types []string
	for _, change := range plan.ResourceChangesMap {
		if !seen[change.Type] {
			seen[change.Type] = true
			types = append(types, change.Type)
		}
	}
	return types
}

// planCloudflareRecordNames returns the `name` field values of all
// cloudflare_record resources in the plan, without creating any real DNS records.
func planCloudflareRecordNames(plan *terraform.PlanStruct) []string {
	var names []string
	for _, change := range plan.ResourceChangesMap {
		if change.Type != "cloudflare_record" {
			continue
		}
		after, ok := change.Change.After.(map[string]interface{})
		if !ok {
			continue
		}
		if name, ok := after["name"].(string); ok {
			names = append(names, name)
		}
	}
	return names
}

// planJSON is used by TestTerraformPlanJSON to do raw JSON assertions.
// Kept as a reference for ad-hoc debugging; not called by default.
func planJSON(t *testing.T, opts *terraform.Options) map[string]interface{} {
	t.Helper()
	raw := terraform.InitAndPlanAndShow(t, opts)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(raw), &out))
	return out
}

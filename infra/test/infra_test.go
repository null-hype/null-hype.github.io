package test

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
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

// copyTerraformDir gives each test its own working directory. Terraform writes
// backend metadata into .terraform, so sharing a checkout can accidentally point
// a later test at an older state backend.
func copyTerraformDir(t *testing.T) string {
	t.Helper()

	src := "../terraform"
	dst := filepath.Join(t.TempDir(), "terraform")
	require.NoError(t, copyDir(src, dst))
	return dst
}

func copyDir(src string, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.Name() == ".terraform" {
			continue
		}

		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if err := copyFile(srcPath, dstPath, info.Mode()); err != nil {
			return err
		}
	}

	return nil
}

func copyFile(src string, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func runTerraform(t *testing.T, dir string, args ...string) string {
	t.Helper()

	cmdArgs := append([]string{"-chdir=" + dir}, args...)
	cmd := exec.Command("terraform", cmdArgs...)
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, "terraform %s failed:\n%s", strings.Join(args, " "), string(output))
	return string(output)
}

// tfOptions returns a base terraform.Options pointed at infra/terraform.
// instanceName is set so test runs use an ephemeral name. DNS is opt-in so the
// mutating apply test cannot accidentally change live Cloudflare records.
func tfOptions(t *testing.T, instanceName string, manageDns bool, manageZoneSettings bool) *terraform.Options {
	t.Helper()

	gcpProject := requiredEnv(t, "GCP_PROJECT")
	cfZoneID := requiredEnv(t, "CLOUDFLARE_ZONE_ID")
	backendBucket := requiredEnv(t, "BACKEND_BUCKET")
	backendPrefixRoot := os.Getenv("BACKEND_PREFIX_ROOT")
	if backendPrefixRoot == "" {
		backendPrefixRoot = "tidelands-test"
	}

	return terraform.WithDefaultRetryableErrors(t, &terraform.Options{
		TerraformDir: copyTerraformDir(t),
		BackendConfig: map[string]interface{}{
			"bucket": backendBucket,
			"prefix": fmt.Sprintf("%s/%s/terraform.tfstate", strings.TrimRight(backendPrefixRoot, "/"), instanceName),
		},
		Vars: map[string]interface{}{
			"gcp_project_id":                gcpProject,
			"instance_name":                 instanceName,
			"machine_type":                  "e2-micro",
			"cloudflare_zone_id":            cfZoneID,
			"deployment_slot":               "blue",
			"env":                           "test",
			"manage_direct_dns_records":     manageDns,
			"manage_slot_origin_dns_record": manageDns,
			"manage_zone_settings":          manageZoneSettings,
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
		TerraformDir: copyTerraformDir(t),
		NoColor:      true,
	}

	runTerraform(t, opts.TerraformDir, "init", "-backend=false", "-no-color")
	runTerraform(t, opts.TerraformDir, "validate", "-no-color")
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

	opts := tfOptions(t, instanceName, true, true)
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
	assert.Contains(t, records, "blue-origin", "plan should include slot origin A record")
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

	opts := tfOptions(t, instanceName, false, false)
	applied := false

	// Teardown: always destroy unless PRESERVE_ON_FAILURE=1 and the test failed.
	defer func() {
		if !applied {
			t.Log("skipping destroy because apply did not complete")
			return
		}
		if t.Failed() && preserveOnFailure() {
			t.Logf("PRESERVE_ON_FAILURE=1: skipping destroy. Clean up manually:")
			t.Logf("  cd infra/terraform && terraform destroy -var=instance_name=%s", instanceName)
			return
		}
		terraform.Destroy(t, opts)
	}()

	terraform.InitAndApply(t, opts)
	applied = true

	// --- Output assertions ---

	ipv4 := terraform.Output(t, opts, "instance_ipv4")
	require.NotEmpty(t, ipv4, "instance_ipv4 output must not be empty")
	t.Logf("instance_ipv4: %s", ipv4)

	name := terraform.Output(t, opts, "instance_name")
	assert.Equal(t, fmt.Sprintf("%s-blue", instanceName), name, "instance_name output must match the provisioned VM name")

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

// Compile author-owned policy with hk's bundled Pkl evaluator, then verify proposals.
package main

import (
	"context"
	"crypto/sha256"
	"dagger/gap-runtime/internal/dagger"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

type GapRuntime struct{}

// Run the existing hk toolchain in Dagger; no standalone Pkl installation.
func (m *GapRuntime) Compile(ctx context.Context, policy *dagger.Directory, hk *dagger.File) (string, error) {
	return dag.Container().From("node:22.16.0-bookworm").
		WithFile("/usr/local/bin/hk", hk, dagger.ContainerWithFileOpts{Permissions: 0755}).
		WithDirectory("/policy", policy).WithWorkdir("/policy").
		WithEnvVariable("HK_PKL_BACKEND", "pklr").
		WithExec([]string{"sh", "-c", "test \"$(hk --version)\" = 'hk 1.57.0'"}).
		WithExec([]string{"git", "init"}).WithExec([]string{"hk", "check", "--all"}).
		File("/policy/compiled.json").Contents(ctx)
}

type policyDocument struct {
	CanonicalWord              string `json:"canonicalWord"`
	RequireVocabularyAdmission bool   `json:"requireVocabularyAdmission"`
	AllowedTool                string `json:"allowedTool"`
	TranslationMaxLength       int    `json:"translationMaxLength"`
	Admitted                   bool   `json:"admitted"`
}

// Verify a compiled immutable snapshot. Only the bridge can mutate the glossary.
func (m *GapRuntime) Verify(ctx context.Context, compiled string, proposal string) (string, error) {
	var policy policyDocument
	if err := json.Unmarshal([]byte(compiled), &policy); err != nil {
		return "", err
	}
	if policy.CanonicalWord == "" || policy.AllowedTool != "submitLoanword" || policy.TranslationMaxLength < 1 {
		return "", fmt.Errorf("invalid compiled policy")
	}
	var input map[string]json.RawMessage
	if err := json.Unmarshal([]byte(proposal), &input); err != nil {
		return "", err
	}
	translation := ""
	accepted := false
	reason := "Provide only a nonempty translation string."
	if len(input) == 1 && json.Unmarshal(input["translation"], &translation) == nil && strings.TrimSpace(translation) != "" && len([]rune(translation)) <= policy.TranslationMaxLength {
		translation = strings.TrimSpace(translation)
		reason = "The lesson policy requires preserving " + policy.CanonicalWord + "."
		if translation == policy.CanonicalWord {
			accepted = !policy.RequireVocabularyAdmission || policy.Admitted
			reason = "This word has not been admitted to the authored vocabulary."
			if accepted {
				reason = "The proposal preserves the word and satisfies the authored vocabulary policy."
			}
		}
	}
	digest := sha256.Sum256([]byte(compiled))
	result, err := json.Marshal(map[string]any{"accepted": accepted, "reason": reason, "translation": translation, "policyHash": hex.EncodeToString(digest[:])})
	return string(result), err
}

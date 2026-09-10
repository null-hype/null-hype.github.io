package main

import (
 "context"
 "encoding/json"
 "fmt"
)

// Inspect exported restic evidence without repository access or filesystem mutation.
// Evidence is supplied by the trusted bridge, never by the browser tool caller.
func (m *GapRuntime) InspectRetrospective(_ context.Context, evidence string, category string) (string, error) {
 var doc struct {
  Version string `json:"version"`
  Before map[string]any `json:"before"`
  After map[string]any `json:"after"`
  Changes []map[string]any `json:"changes"`
  Limitations string `json:"limitations"`
 }
 if err := json.Unmarshal([]byte(evidence), &doc); err != nil { return "", err }
 if doc.Version != "1" { return "", fmt.Errorf("unsupported retrospective evidence version") }
 allowed := map[string]bool{"all":true, "session":true, "worktree":true, "monitoring":true, "other":true}
 if !allowed[category] { return "", fmt.Errorf("choose a category advertised by the investigation schema") }
 counts := map[string]int{}
 changes := []map[string]any{}
 for _, change := range doc.Changes {
  c, _ := change["category"].(string)
  counts[c]++
  if (category == "all" || category == c) && len(changes) < 30 { changes = append(changes, change) }
 }
 result, err := json.Marshal(map[string]any{
  "before":doc.Before, "after":doc.After, "category":category,
  "counts":counts, "changes":changes, "totalChanges":len(doc.Changes),
  "returnedChanges":len(changes), "rowLimit":30,
  "limitations":doc.Limitations,
  "source":"Exported restic comparison; this call does not refresh the repository or infer causes.",
 })
 return string(result), err
}

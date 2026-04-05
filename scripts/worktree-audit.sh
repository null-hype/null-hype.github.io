#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

status_for_worktree() {
  local path="$1"

  if [[ ! -d "$path" ]]; then
    printf 'missing'
    return
  fi

  if [[ -n "$(git -C "$path" status --short 2>/dev/null)" ]]; then
    printf 'dirty'
  else
    printf 'clean'
  fi
}

scope_for_worktree() {
  local path="$1"

  case "$path" in
    "$REPO_ROOT"/.worktrees/*) printf 'in-repo' ;;
    "$REPO_ROOT") printf 'main' ;;
    *) printf 'external' ;;
  esac
}

tracking_for_branch() {
  local path="$1"
  local branch="$2"
  local tracking

  tracking="$(git -C "$path" for-each-ref --format='%(upstream:trackshort)' "refs/heads/${branch}" 2>/dev/null || true)"
  printf '%s' "${tracking:--}"
}

print_record() {
  local path="$1"
  local head="$2"
  local branch="$3"
  local prunable="$4"
  local worktree_status scope upstream tracking

  worktree_status="$(status_for_worktree "$path")"
  scope="$(scope_for_worktree "$path")"

  if [[ -n "$prunable" ]]; then
    printf '%-8s %-8s %-20s %-12s %-6s %s\n' "$scope" "prunable" "${branch:--}" "--" "--" "$path"
    return
  fi

  if [[ "$worktree_status" == "missing" ]]; then
    printf '%-8s %-8s %-20s %-12s %-6s %s\n' "$scope" "missing" "${branch:--}" "--" "--" "$path"
    return
  fi

  upstream="$(git -C "$path" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  tracking="$(tracking_for_branch "$path" "$branch")"

  printf '%-8s %-8s %-20s %-12s %-6s %s\n' "$scope" "$worktree_status" "${branch:--}" "${upstream:--}" "$tracking" "$path"
}

printf '%-8s %-8s %-20s %-12s %-6s %s\n' "scope" "state" "branch" "upstream" "track" "path"

current_path=""
current_head=""
current_branch=""
current_prunable=""

flush_record() {
  if [[ -n "$current_path" ]]; then
    print_record "$current_path" "$current_head" "$current_branch" "$current_prunable"
  fi
  current_path=""
  current_head=""
  current_branch=""
  current_prunable=""
}

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" ]]; then
    flush_record
    continue
  fi

  key="${line%% *}"
  value="${line#* }"

  case "$key" in
    worktree)
      flush_record
      current_path="$value"
      ;;
    HEAD)
      current_head="$value"
      ;;
    branch)
      current_branch="${value#refs/heads/}"
      ;;
    prunable)
      current_prunable="$value"
      ;;
  esac
done < <(git worktree list --porcelain)

flush_record

printf '\nSuggested follow-up:\n'
printf '  git worktree prune\n'
printf '  git worktree remove <path>\n'
printf '  export NULL_HYPE_ENV_FILES=relative/or/absolute.env\n'

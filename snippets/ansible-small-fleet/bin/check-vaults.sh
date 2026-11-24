#!/usr/bin/env bash
# Fails if any vault.yml is not encrypted. Run it in CI, and as a pre-commit hook if you like.
set -euo pipefail

status=0
while IFS= read -r -d '' vault_file; do
    if ! head -n 1 "$vault_file" | grep -q '^\$ANSIBLE_VAULT;'; then
        echo "not encrypted: $vault_file" >&2
        status=1
    fi
done < <(find inventory -name vault.yml -print0)

exit "$status"

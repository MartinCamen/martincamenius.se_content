#!/usr/bin/env bash
# Applies the baseline to a throwaway container twice, checks the second run changes nothing,
# then collects facts as the report user. Needs Docker. Run it from the snippet folder.
set -euo pipefail

container=ansible-test-server
# The container has no secrets. A dummy password file stops the vault prompt.
export ANSIBLE_VAULT_IDENTITY_LIST=default@test/unused-vault-password

docker build --quiet --tag ansible-test-server test >/dev/null
docker rm --force "$container" >/dev/null 2>&1 || true
docker run --detach --name "$container" --privileged --cgroupns=host \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:rw ansible-test-server >/dev/null
trap 'docker rm --force "$container" >/dev/null' EXIT

ansible-playbook -i test/inventory.yml playbooks/baseline.yml

echo "Second run, which must change nothing:"
second_run=$(ansible-playbook -i test/inventory.yml playbooks/baseline.yml)
echo "$second_run" | tail -n 3
if ! echo "$second_run" | grep -q 'changed=0 '; then
    echo "The second run changed something. The baseline is not idempotent." >&2
    exit 1
fi

ansible-playbook -i test/inventory.yml playbooks/facts.yml

echo "The report user may run the facts script and nothing else:"
if docker exec --user ansible-report "$container" sudo --non-interactive id >/dev/null 2>&1; then
    echo "The report user could run another command as root." >&2
    exit 1
fi
echo "ok"

echo "Without a terminal, the patch run must stop before it changes anything:"
if ansible-playbook -i test/inventory.yml playbooks/patch.yml </dev/null >/dev/null 2>&1; then
    echo "The patch run went ahead without anyone answering." >&2
    exit 1
fi
echo "ok"

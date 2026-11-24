# ansible-small-fleet

A small Ansible setup for a handful of Ubuntu servers, for teams without an ops
department. It goes with a three-part blog series on
[martincamenius.se](https://martincamenius.se). It's a starting point, not a
finished product: copy the parts you need.

What it does:

- **Baseline** (`playbooks/baseline.yml`): nightly security updates that never
  restart MySQL, PHP-FPM, nginx, Redis or supervisor; a reboot after a kernel
  crash instead of a server that hangs; and a locked-down user for reading facts.
- **Facts** (`playbooks/facts.yml`): OS, kernel, pending security updates,
  reboot needed, and the versions of PHP, MySQL, nginx and friends, one JSON file
  per server.
- **Patching** (`playbooks/patch.yml`): the monthly window, one server at a
  time, less important servers first, with a yes required before anything that
  can cause downtime.

## Files

| Path | What it is |
| --- | --- |
| `ansible.cfg` | Points at the inventory and roles, and asks for the vault password on every run |
| `inventory/hosts.yml` | The servers, grouped by who patches them and how critical they are |
| `inventory/host_vars/<host>/vault.yml.example` | The secret keys a host needs, with empty values |
| `inventory/group_vars/all/vars.yml` | The report user's public key and the addresses it may log in from |
| `roles/unattended_upgrades` | Security updates only, held packages, and needrestart told not to restart |
| `roles/kernel_crash_recovery` | `kernel.panic_on_oops = 1` and `kernel.panic = 10` |
| `roles/report_user` | A user with no password, one SSH key from fixed addresses, and one sudo rule |
| `roles/report_user/files/server-facts` | The read-only facts script that sudo rule allows |
| `playbooks/tasks/patch-host.yml` | The steps and questions for one server in the patch run |
| `bin/check-vaults.sh` | Fails if any `vault.yml` isn't encrypted |
| `test/` | A systemd container to try it all on |

## Getting started

Install Ansible (pin the version; new Python releases can break older
ansible-core releases):

```bash
pipx install ansible-core
```

1. Put your servers in `inventory/hosts.yml`. Servers your host patches go in
   `provider_managed`, which no playbook targets.
2. For each server, create its vault with `ansible-vault create
   inventory/host_vars/<host>/vault.yml` and paste the keys from the example.
   Keep the vault password in a password manager.
3. Create an SSH key for the report user, and put its public half and your IP
   in `inventory/group_vars/all/vars.yml`.
4. Preview, apply, and apply again:

   ```bash
   ansible-playbook playbooks/baseline.yml --limit web-1 --check --diff
   ansible-playbook playbooks/baseline.yml --limit web-1
   ansible-playbook playbooks/baseline.yml --limit web-1   # must say changed=0
   ```

5. Collect facts with the report user's key:

   ```bash
   ANSIBLE_PRIVATE_KEY_FILE=~/.ssh/ansible-report ansible-playbook playbooks/facts.yml
   ```

6. On patch day:

   ```bash
   ansible-playbook playbooks/patch.yml
   ```

## Trying it in Docker

`test/run.sh` starts an Ubuntu 24.04 container with systemd, applies the
baseline twice, checks the second run changes nothing, collects facts as the
report user, checks that user can't run anything else as root, and checks that
a patch run without a terminal stops before it changes anything. It needs Docker
and the `community.docker` collection:

```bash
ansible-galaxy collection install -r requirements.yml
test/run.sh
```

## Things worth knowing

- **needrestart's list mode isn't enough on Ubuntu 24.04 and later.**
  Unattended upgrades restart services anyway
  ([Launchpad bug 2068543](https://bugs.launchpad.net/bugs/2068543)), so every
  service that serves traffic is also excluded by name with `override_rc`.
- **Ubuntu 26.04 uses sudo-rs by default**, and Ansible times out waiting for
  its password prompt. Set `ansible_become_exe: sudo.ws` on those hosts.
- **The facts playbook calls `sudo` itself** instead of using `become`, because
  `become` wraps the command in a shell and the narrow sudoers rule wouldn't
  match.
- **A container can't change kernel settings**, so `kernel_crash_recovery` only
  writes its file there. On a real server it also loads it.
- **The patch run is a sketch.** It doesn't post results anywhere, upgrade
  MySQL in its own step or pause deploys. Add what your setup needs.
- `ansible.cfg` asks for the vault password on every run. The test sets
  `ANSIBLE_VAULT_IDENTITY_LIST` to a dummy file instead; lint and CI can do the
  same.

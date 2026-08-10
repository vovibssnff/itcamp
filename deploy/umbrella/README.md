# Umbrella Helm chart (`ktc`)

Deploys app-namespace services: auth, gw, constructor, scenario, orchestrator, assessment, snapshot, report, fe.

```bash
cd deploy/umbrella
helm dependency update
helm template ktc . -f values-prod.yaml
# Install (usually via Ansible role app_deploy):
# helm upgrade --install ktc . -n ktc-app -f values-prod.yaml
```

`sim-manager` and `ai` are installed as separate releases into `ktc-sim` / `ktc-ai` by Ansible.

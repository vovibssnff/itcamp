# Day-2: production KTC (Deckhouse + Ansible)

## Updates

| What | How |
|---|---|
| Cloud VMs / network / FIP / S3 | `cd infra/terraform && terraform apply -var-file=env/prod.tfvars` then `ansible-playbook site.yml --tags nodes` |
| Deckhouse platform | release channel / update windows in ModuleConfig `deckhouse` |
| Application release | CI push images → `ansible-playbook site.yml --tags apps -e ktc_image_tag=vX.Y.Z` |
| Data-layer | edit `deploy/data-layer/values.yaml` / helm values in role → `--tags data` |

## Scale

1. Raise `app_count` / `sim_count` / `ai_count` / `db_count` in `env/prod.tfvars`
2. `terraform apply`
3. `ansible-playbook site.yml --tags nodes,modules`

## Backups

- Terraform state: S3 bucket with versioning
- Picodata: schedule CronJob dump to S3 (add under Day-2 when ready)
- Object buckets: enable versioning in VK Cloud console
- Deckhouse etcd: platform backup mechanism

## Rollback

```bash
helm -n ktc-app rollback ktc
# or
ansible-playbook site.yml --tags apps -e ktc_image_tag=<previous>
```

## Certificates

- HTTP-01 via cert-manager ClusterIssuer `letsencrypt`
- After staging works: set `ktc_letsencrypt_prod: true` and re-run `--tags edge`

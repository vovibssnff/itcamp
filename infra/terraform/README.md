# Terraform — VK Cloud (teststand + production)

## Common

```bash
source ~/openrc.sh   # from VK Cloud console
export TF_VAR_vkcs_username="$OS_USERNAME"
export TF_VAR_vkcs_password="$OS_PASSWORD"
export TF_VAR_vkcs_project_id="$OS_PROJECT_ID"
# optional S3:
# export TF_VAR_s3_access_key=...
# export TF_VAR_s3_secret_key=...

cd infra/terraform
terraform init
```

## Teststand (network + FIP + S3 only)

```bash
cp env/teststand.tfvars.example env/teststand.tfvars
terraform plan  -var-file=env/teststand.tfvars
terraform apply -var-file=env/teststand.tfvars
terraform output
```

## Production (network + FIP + S3 + N static worker VMs + Ansible inventory)

```bash
cp env/prod.tfvars.example env/prod.tfvars
# REQUIRED: set domain, ssh_public_key, flavors/counts
terraform plan  -var-file=env/prod.tfvars
terraform apply -var-file=env/prod.tfvars
terraform output ingress_floating_ip
terraform output static_nodes
# Writes: infra/ansible/inventory/prod/hosts.ini
```

Static workers (app/sim/ai/db) are adopted into Deckhouse via CAPS (Ansible role `deckhouse_static_nodes`). Masters are created by Deckhouse Hybrid bootstrap.

See `docs/infra_vkcloud_prod_ansible.plan.md` and `infra/ansible/README.md`.

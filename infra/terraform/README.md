# Terraform — VK Cloud (teststand)
#
# Prerequisites: openrc v3 from VK Cloud console (API access tab).
#
#   source ~/Downloads/openrc.sh
#   export TF_VAR_vkcs_username="$OS_USERNAME"
#   export TF_VAR_vkcs_password="$OS_PASSWORD"
#   export TF_VAR_vkcs_project_id="$OS_PROJECT_ID"
#
#   cp env/teststand.tfvars.example env/teststand.tfvars   # fill non-secrets
#   terraform init
#   terraform plan  -var-file=env/teststand.tfvars
#   terraform apply -var-file=env/teststand.tfvars
#   terraform output
#
# After first apply, enable remote S3 backend in providers.tf and:
#   terraform init -migrate-state
#
# Pass deckhouse_hints / ingress_floating_ip into infra/deckhouse/config.yml

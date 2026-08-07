# Deckhouse EE — VK Cloud teststand
#
# 1. Get EE license: https://deckhouse.ru (trial / sales)
# 2. docker login registry.deckhouse.io -u license-token -p <KEY>
# 3. Source VK Cloud openrc v3
# 4. Copy config.yml.example → config.yml, fill SSH key, OS_*, domain, flavors
# 5. Optionally apply Terraform first (infra/terraform) for floating IP / S3
# 6. ./scripts/bootstrap.sh
# 7. Apply modules/ingress-controller.yaml (set FLOATING_IP)
# 8. Apply nodegroups/ if not fully bootstrapped via config.yml
# 9. kubectl apply -f ../namespaces/
#
# config.yml and dhctl-tmp/ are gitignored.

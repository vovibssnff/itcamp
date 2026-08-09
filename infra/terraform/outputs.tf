output "network_id" {
  value = vkcs_networking_network.app.id
}

output "subnet_id" {
  value = vkcs_networking_subnet.app.id
}

output "router_id" {
  value = vkcs_networking_router.app.id
}

output "external_network_id" {
  value = data.vkcs_networking_network.ext.id
}

output "external_network_name" {
  value = var.ext_network_name
}

output "ingress_floating_ip" {
  description = "White IP for Ingress / DNS A-record"
  value       = vkcs_networking_floatingip.ingress.address
}

output "ingress_floating_ip_id" {
  value = vkcs_networking_floatingip.ingress.id
}

output "security_group_id" {
  value = vkcs_networking_secgroup.cluster.id
}

output "s3_tfstate_bucket" {
  value = try(aws_s3_bucket.tfstate[0].bucket, null)
}

output "s3_snapshots_bucket" {
  value = try(aws_s3_bucket.snapshots[0].bucket, null)
}

output "s3_reports_bucket" {
  value = try(aws_s3_bucket.reports[0].bucket, null)
}

output "s3_component_icons_bucket" {
  value = try(aws_s3_bucket.component_icons[0].bucket, null)
}

output "deckhouse_hints" {
  description = "Values to paste into infra/deckhouse/config.yml"
  value = {
    internalNetworkCIDR = var.subnet_cidr
    internalNetworkName = vkcs_networking_network.app.name
    externalNetworkName = var.ext_network_name
    floatingIP          = vkcs_networking_floatingip.ingress.address
  }
}

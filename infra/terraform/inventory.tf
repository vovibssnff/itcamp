resource "local_file" "ansible_inventory" {
  count    = length(local.static_nodes) > 0 ? 1 : 0
  filename = "${path.module}/${var.ansible_inventory_path}"
  content = templatefile("${path.module}/inventory.tftpl", {
    nodes = {
      for k, v in vkcs_compute_instance.node : k => {
        ip   = v.access_ip_v4
        role = local.static_nodes[k].role
      }
    }
    domain       = var.domain
    ingress_fip  = vkcs_networking_floatingip.ingress.address
    cluster_name = var.cluster_name
  })
  file_permission = "0644"
}

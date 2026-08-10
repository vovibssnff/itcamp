# Static worker VMs for Deckhouse CAPS (app/sim/ai/db).
# Masters are created by Deckhouse Hybrid OpenStackClusterConfiguration.

data "vkcs_images_image" "ubuntu" {
  count = var.ssh_public_key != "" ? 1 : 0
  name  = var.image_name
}

resource "vkcs_compute_keypair" "ktc" {
  count      = var.ssh_public_key != "" ? 1 : 0
  name       = "${var.cluster_name}-key"
  public_key = var.ssh_public_key
}

locals {
  static_roles = {
    app = var.app_count
    sim = var.sim_count
    ai  = var.ai_count
    db  = var.db_count
  }
  static_flavor = {
    app = var.flavor_app
    sim = var.flavor_sim
    ai  = var.flavor_ai
    db  = var.flavor_db
  }
  static_disk = {
    app = 50
    sim = 50
    ai  = 100
    db  = 100
  }
  static_nodes = var.ssh_public_key == "" ? {} : merge([
    for role, n in local.static_roles : {
      for i in range(n) :
      "${role}-${i}" => { role = role, index = i }
    }
  ]...)
}

resource "vkcs_compute_instance" "node" {
  for_each          = local.static_nodes
  name              = "${var.cluster_name}-${each.key}"
  flavor_name       = local.static_flavor[each.value.role]
  key_pair          = vkcs_compute_keypair.ktc[0].name
  security_groups = [vkcs_networking_secgroup.cluster.name]
  availability_zone = var.availability_zone

  network {
    uuid = vkcs_networking_network.app.id
  }

  block_device {
    source_type           = "image"
    destination_type      = "volume"
    uuid                  = data.vkcs_images_image.ubuntu[0].id
    volume_type           = var.volume_type
    volume_size           = local.static_disk[each.value.role]
    boot_index            = 0
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    role = each.value.role
  })

  metadata = {
    ktc_role     = each.value.role
    cluster_name = var.cluster_name
  }
}

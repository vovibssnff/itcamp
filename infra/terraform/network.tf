data "vkcs_networking_network" "ext" {
  name = var.ext_network_name
}

resource "vkcs_networking_network" "app" {
  name           = "${var.cluster_name}-net"
  admin_state_up = true
}

resource "vkcs_networking_subnet" "app" {
  name            = "${var.cluster_name}-subnet"
  network_id      = vkcs_networking_network.app.id
  cidr            = var.subnet_cidr
  dns_nameservers = var.dns_nameservers
}

resource "vkcs_networking_router" "app" {
  name                = "${var.cluster_name}-router"
  admin_state_up      = true
  external_network_id = data.vkcs_networking_network.ext.id
}

resource "vkcs_networking_router_interface" "app" {
  router_id = vkcs_networking_router.app.id
  subnet_id = vkcs_networking_subnet.app.id
}

# Floating IP for Ingress LB (white IP). Bind via Deckhouse ingress-nginx annotations.
resource "vkcs_networking_floatingip" "ingress" {
  pool = var.ext_network_name
}

resource "vkcs_networking_secgroup" "cluster" {
  name        = "${var.cluster_name}-sg"
  description = "KTC teststand cluster security group"
}

resource "vkcs_networking_secgroup_rule" "ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vkcs_networking_secgroup.cluster.id
  description       = "SSH for bootstrap / admin"
}

resource "vkcs_networking_secgroup_rule" "https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vkcs_networking_secgroup.cluster.id
  description       = "HTTPS public API"
}

resource "vkcs_networking_secgroup_rule" "http_acme" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vkcs_networking_secgroup.cluster.id
  description       = "HTTP for ACME HTTP-01 and redirects"
}

resource "vkcs_networking_secgroup_rule" "kube_api" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vkcs_networking_secgroup.cluster.id
  description       = "Kubernetes API (restrict in production)"
}

resource "vkcs_networking_secgroup_rule" "egress" {
  direction         = "egress"
  ethertype         = "IPv4"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vkcs_networking_secgroup.cluster.id
}

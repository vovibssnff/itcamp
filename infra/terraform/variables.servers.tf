# Production static worker counts / flavors (masters are CloudEphemeral via Deckhouse Hybrid).

variable "app_count" {
  type    = number
  default = 2
}

variable "sim_count" {
  type    = number
  default = 2
}

variable "ai_count" {
  type        = number
  default     = 0
  description = "Set to 1+ when GPU flavor/quota is available"
}

variable "db_count" {
  type    = number
  default = 3
}

variable "flavor_app" {
  type    = string
  default = "STD3-4-8"
}

variable "flavor_sim" {
  type    = string
  default = "STD3-8-16"
}

variable "flavor_ai" {
  type        = string
  default     = "GPU1-8-32"
  description = "Replace with a real VK Cloud GPU flavor name"
}

variable "flavor_db" {
  type    = string
  default = "STD3-4-16"
}

variable "image_name" {
  type    = string
  default = "ubuntu-22-04-cloudamd64"
}

variable "availability_zone" {
  type    = string
  default = "MS1"
}

variable "ssh_public_key" {
  type        = string
  description = "Contents of ktc_ed25519.pub (or equivalent)"
  default     = ""
}

variable "domain" {
  type        = string
  description = "Production apex domain, e.g. ktk.example.ru"
  default     = "ktk.example.ru"
}

variable "volume_type" {
  type    = string
  default = "high-iops"
}

variable "ansible_inventory_path" {
  type        = string
  description = "Where to write generated Ansible inventory"
  default     = "../ansible/inventory/prod/hosts.ini"
}

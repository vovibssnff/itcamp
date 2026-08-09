variable "vkcs_username" {
  type        = string
  description = "VK Cloud API username (from openrc v3)"
}

variable "vkcs_password" {
  type        = string
  sensitive   = true
  description = "VK Cloud API password"
}

variable "vkcs_project_id" {
  type        = string
  description = "VK Cloud project ID"
}

variable "vkcs_region" {
  type    = string
  default = "RegionOne"
}

variable "vkcs_auth_url" {
  type    = string
  default = "https://infra.mail.ru:35357/v3/"
}

variable "ext_network_name" {
  type        = string
  description = "External (public) network name for floating IPs / router gateway"
  default     = "internet"
}

variable "cluster_name" {
  type    = string
  default = "ktc-teststand"
}

variable "subnet_cidr" {
  type    = string
  default = "10.20.0.0/24"
}

variable "dns_nameservers" {
  type    = list(string)
  default = ["8.8.8.8", "1.1.1.1"]
}

variable "create_app_buckets" {
  type        = bool
  description = "Create application S3 buckets (snapshots/reports/component-icons)"
  default     = true
}

variable "create_tfstate_bucket" {
  type        = bool
  description = "Create S3 bucket for Terraform remote state (first bootstrap)"
  default     = true
}

variable "s3_endpoint" {
  type        = string
  description = "VK Cloud Object Storage S3 endpoint"
  default     = "https://hb.ru-msk.vkcloud-storage.ru"
}

variable "s3_region" {
  type    = string
  default = "ru-msk"
}

variable "s3_access_key" {
  type        = string
  sensitive   = true
  description = "S3 access key (from VK Cloud IAM S3 account)"
  default     = ""
}

variable "s3_secret_key" {
  type        = string
  sensitive   = true
  description = "S3 secret key"
  default     = ""
}

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    vkcs = {
      source  = "vk-cs/vkcs"
      version = "~> 0.9"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "< 5.85.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }

  # Remote state in VK Cloud Object Storage (HotBox) — enable after first apply
  # creates the tfstate bucket and you have S3 access keys:
  #
  # backend "s3" {
  #   endpoints = { s3 = "https://hb.ru-msk.vkcloud-storage.ru" }
  #   bucket                      = "ktc-teststand-tfstate"
  #   key                         = "teststand/terraform.tfstate"
  #   region                      = "ru-msk"
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_s3_checksum            = true
  #   skip_metadata_api_check     = true
  # }
}

provider "vkcs" {
  username   = var.vkcs_username
  password   = var.vkcs_password
  project_id = var.vkcs_project_id
  region     = var.vkcs_region
  auth_url   = var.vkcs_auth_url
}

# HotBox / Object Storage — S3-compatible API via AWS provider.
# Create IAM S3 account keys in VK Cloud console (or vkcs_iam_s3_account).
provider "aws" {
  region                      = var.s3_region
  access_key                  = var.s3_access_key
  secret_key                  = var.s3_secret_key
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  skip_region_validation      = true

  endpoints {
    s3 = var.s3_endpoint
  }
}

# Object Storage via AWS provider (VK Cloud HotBox).
# Requires s3_access_key / s3_secret_key (create S3 account in VK Cloud console).

resource "aws_s3_bucket" "tfstate" {
  count         = var.create_tfstate_bucket && var.s3_access_key != "" ? 1 : 0
  bucket        = "${var.cluster_name}-tfstate"
  force_destroy = false
}

resource "aws_s3_bucket" "snapshots" {
  count         = var.create_app_buckets && var.s3_access_key != "" ? 1 : 0
  bucket        = "${var.cluster_name}-snapshots"
  force_destroy = false
}

resource "aws_s3_bucket" "reports" {
  count         = var.create_app_buckets && var.s3_access_key != "" ? 1 : 0
  bucket        = "${var.cluster_name}-reports"
  force_destroy = false
}

resource "aws_s3_bucket" "component_icons" {
  count         = var.create_app_buckets && var.s3_access_key != "" ? 1 : 0
  bucket        = "${var.cluster_name}-component-icons"
  force_destroy = false
}

resource "aws_s3_bucket_acl" "tfstate" {
  count  = length(aws_s3_bucket.tfstate)
  bucket = aws_s3_bucket.tfstate[0].id
  acl    = "private"
}

resource "aws_s3_bucket_acl" "snapshots" {
  count  = length(aws_s3_bucket.snapshots)
  bucket = aws_s3_bucket.snapshots[0].id
  acl    = "private"
}

resource "aws_s3_bucket_acl" "reports" {
  count  = length(aws_s3_bucket.reports)
  bucket = aws_s3_bucket.reports[0].id
  acl    = "private"
}

resource "aws_s3_bucket_acl" "component_icons" {
  count  = length(aws_s3_bucket.component_icons)
  bucket = aws_s3_bucket.component_icons[0].id
  acl    = "private"
}

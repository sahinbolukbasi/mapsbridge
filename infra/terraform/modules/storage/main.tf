# MapsBridge Storage Module — S3 buckets for media, PDFs, analytics
# Well-Architected: Cost optimized — S3 Intelligent-Tiering for analytics,
# lifecycle policies to expire old data, CloudFront CDN for public content

locals {
  substack_name = "${var.name}-storage"
}

# ─── Public Media Bucket (user photos, avatars) ───────────────────────────
resource "aws_s3_bucket" "media" {
  bucket        = "${local.substack_name}-media-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = var.environment == "prod" ? "Enabled" : "Suspended"
  }
}

# CloudFront OAC for media bucket
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${local.substack_name}-media-oac"
  description                       = "Private S3 access for media"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.media.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = var.cloudfront_distribution_arn }
      }
    }]
  })
}

# ─── Private PDF Guides Bucket (rehberler) ────────────────────────────────
resource "aws_s3_bucket" "guides" {
  bucket        = "${local.substack_name}-guides-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "guides" {
  bucket                  = aws_s3_bucket.guides.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "guides" {
  bucket = aws_s3_bucket.guides.id
  versioning_configuration {
    status = "Enabled"
  }
}

# CORS for guides — only allow Lambda access via pre-signed URLs
resource "aws_s3_bucket_cors_configuration" "guides" {
  bucket = aws_s3_bucket.guides.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = var.cors_origins
    max_age_seconds = 3600
  }
}

# Lifecycle — expire old objects after 365 days (guides may be updated)
resource "aws_s3_bucket_lifecycle_configuration" "guides" {
  bucket = aws_s3_bucket.guides.id
  rule {
    filter {}
    id     = "expire-old-guides"
    status = "Enabled"
    expiration {
      days = 365
    }
  }
}

# ─── Analytics Bucket (Kinesis Firehose → S3) ─────────────────────────────
resource "aws_s3_bucket" "analytics" {
  bucket        = "${local.substack_name}-analytics-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "analytics" {
  bucket                  = aws_s3_bucket.analytics.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "analytics" {
  bucket = aws_s3_bucket.analytics.id
  versioning_configuration {
    status = "Suspended"
  }
}

# Intelligent-Tiering for cost-effective analytics storage
resource "aws_s3_bucket_intelligent_tiering_configuration" "analytics" {
  bucket = aws_s3_bucket.analytics.id
  name   = "analytics-tiering"
  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

# Lifecycle — move to Standard-IA after 30 days, expire after 730 days
resource "aws_s3_bucket_lifecycle_configuration" "analytics" {
  bucket = aws_s3_bucket.analytics.id
  rule {
    filter {}
    id     = "transition-ia"
    status = "Enabled"
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    expiration {
      days = 730
    }
  }
}

# Athena query results bucket
resource "aws_s3_bucket" "athena" {
  bucket        = "${local.substack_name}-athena-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.environment != "prod"
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "athena" {
  bucket                  = aws_s3_bucket.athena.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_caller_identity" "current" {}

# ─── SSM Parameter Store for bucket names ─────────────────────────────────
resource "aws_ssm_parameter" "media_bucket" {
  name  = "/mapsbridge/${var.environment}/s3/media-bucket"
  type  = "String"
  value = aws_s3_bucket.media.id
  tags  = var.tags
}

resource "aws_ssm_parameter" "guides_bucket" {
  name  = "/mapsbridge/${var.environment}/s3/guides-bucket"
  type  = "String"
  value = aws_s3_bucket.guides.id
  tags  = var.tags
}

resource "aws_ssm_parameter" "analytics_bucket" {
  name  = "/mapsbridge/${var.environment}/s3/analytics-bucket"
  type  = "String"
  value = aws_s3_bucket.analytics.id
  tags  = var.tags
}
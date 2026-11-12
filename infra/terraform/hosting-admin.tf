# ─── Admin Panel — Ayrı domain + WAF IP kısıtlaması ─────────────────────────
#
# admin.mapsbridge.com ayrı bir CloudFront distribution üzerinden sunulur.
# WAF Web ACL yalnızca izin verilen IP bloklarından erişime izin verir.
# Ana distribution'da /u/admin/* tamamen kapatılır (spa_router güncellenir).
#
# Gerekli değişkenler (terraform.tfvars veya -var ile):
#   admin_domain              = "admin.mapsbridge.com"
#   admin_acm_certificate_arn = "<us-east-1 ACM ARN>"   # wildcardsa mevcut cert geçer
#   admin_allowed_cidrs       = ["203.0.113.0/24", "192.168.1.42/32"]
# ─────────────────────────────────────────────────────────────────────────────

# CloudFront WAF için us-east-1 zorunludur
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "mapsbridge"
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "main"
    }
  }
}

variable "admin_domain" {
  type        = string
  default     = ""
  description = "Admin panel subdomain (e.g. admin.mapsbridge.com). Empty = admin distribution is not created."
}

variable "admin_acm_certificate_arn" {
  type        = string
  default     = ""
  description = "ACM certificate ARN for admin domain (must be in us-east-1). Defaults to acm_certificate_arn if empty."
}

variable "admin_allowed_cidrs" {
  type        = list(string)
  default     = []
  description = "IP CIDR blocks that may access the admin panel. Empty = no WAF IP restriction (Cognito auth only)."
}

locals {
  admin_enabled     = var.admin_domain != ""
  admin_waf_enabled = local.admin_enabled && length(var.admin_allowed_cidrs) > 0
  admin_cert_arn    = var.admin_acm_certificate_arn != "" ? var.admin_acm_certificate_arn : var.acm_certificate_arn
}

# ── WAF: İzinli IP seti ────────────────────────────────────────────────────

resource "aws_wafv2_ip_set" "admin_allowed" {
  provider           = aws.us_east_1
  count              = local.admin_waf_enabled ? 1 : 0
  name               = "${local.name}-admin-allowed-ips"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = var.admin_allowed_cidrs
  tags               = local.tags
}

# ── WAF Web ACL: Varsayılan BLOCK, izinli IP → ALLOW ──────────────────────

resource "aws_wafv2_web_acl" "admin" {
  provider = aws.us_east_1
  count    = local.admin_waf_enabled ? 1 : 0
  name     = "${local.name}-admin-acl"
  scope    = "CLOUDFRONT"
  tags     = local.tags

  default_action {
    block {}
  }

  rule {
    name     = "allow-admin-ips"
    priority = 0
    action {
      allow {}
    }
    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.admin_allowed[0].arn
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-admin-allowed-ips"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-admin-acl"
    sampled_requests_enabled   = true
  }
}

# ── Admin CloudFront Function: Basit SPA router (locale yönlendirmesi yok) ─

resource "aws_cloudfront_function" "admin_router" {
  count   = local.admin_enabled ? 1 : 0
  name    = "${local.name}-admin-router"
  runtime = "cloudfront-js-2.0"
  comment = "Admin SPA router — routes requests to isolated admin bundle index.html"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Dosya uzantısı içeren statik varlıklar (_next, css, js, ico, png)
      if (uri.indexOf('.') !== -1) {
        return request;
      }

      // Dizin yolları index.html ile tamamlanır
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
        return request;
      }

      // SPA alt yolları için index.html
      request.uri = uri + '/index.html';
      return request;
    }
  JS
}

# ── Admin CloudFront Distribution ─────────────────────────────────────────

resource "aws_cloudfront_distribution" "admin" {
  count               = local.admin_enabled ? 1 : 0
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = [var.admin_domain]
  web_acl_id          = local.admin_waf_enabled ? aws_wafv2_web_acl.admin[0].arn : null
  tags                = local.tags

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "admin-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "admin-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    # Admin içeriği önbelleğe alınmaz
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled managed policy

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.admin_router[0].arn
    }
    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = local.admin_cert_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

}

# ── Route53: admin.mapsbridge.com ─────────────────────────────────────────

resource "aws_route53_record" "admin" {
  count   = local.admin_enabled && var.hosted_zone_id != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.admin_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.admin[0].domain_name
    zone_id                = aws_cloudfront_distribution.admin[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────

output "admin_distribution_id" {
  value       = local.admin_enabled ? aws_cloudfront_distribution.admin[0].id : null
  description = "Admin CloudFront distribution ID"
}

output "admin_distribution_domain" {
  value       = local.admin_enabled ? aws_cloudfront_distribution.admin[0].domain_name : null
  description = "Admin CloudFront domain (fallback URL if Route53 not configured)"
}

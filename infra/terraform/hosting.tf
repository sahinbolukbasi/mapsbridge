# Static web hosting — S3 + CloudFront (SPA). Kept from the original foundation.
# Backend APIs are now provided by modules: api (HTTP), messaging (WebSocket).
resource "aws_s3_bucket" "web" {
  bucket        = "${local.name}-${data.aws_caller_identity.current.account_id}-web"
  force_destroy = false
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name}-web-oac"
  description                       = "Private S3 access for ${local.name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "spa_router" {
  name    = "${local.name}-spa-router"
  runtime = "cloudfront-js-2.0"
  comment = "Locale-aware SPA router: detect language, set cookie, resolve index.html"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      var cookies = request.cookies || {};
      var headers = request.headers || {};

      // On root path with no locale cookie, detect language and redirect
      if (uri === '/' || uri === '') {
        var hasLocaleCookie = cookies['locale'] && cookies['locale'].value;
        if (!hasLocaleCookie) {
          var preferEn = false;
          var acceptLang = headers['accept-language'] && headers['accept-language'].value;
          if (acceptLang) {
            // Simple Accept-Language parsing: if 'tr' appears first or alone, serve Turkish
            var langs = acceptLang.toLowerCase();
            var trIdx = langs.indexOf('tr');
            var enIdx = langs.indexOf('en');
            if (trIdx === -1 && enIdx >= 0) preferEn = true;
            else if (trIdx >= 0 && enIdx >= 0 && enIdx < trIdx) preferEn = true;
            else if (trIdx === -1 && enIdx === -1) preferEn = true;
          } else {
            preferEn = true;
          }
          if (preferEn) {
            return {
              statusCode: 302,
              statusDescription: 'Found',
              headers: {
                'location': { value: '/en/' },
                'cache-control': { value: 'no-cache' }
              },
              cookies: {
                'locale': { value: 'en', attributes: 'Path=/; Max-Age=31536000; SameSite=Lax' }
              }
            };
          }
          // Turkish visitor: set cookie, continue to Turkish homepage
          request.headers['x-locale-cookie'] = { value: 'locale=tr; Path=/; Max-Age=31536000; SameSite=Lax' };
        }
      }

      // SPA routing: append index.html for directory paths
      if (uri.endsWith('/')) {
        request.uri += 'index.html';
      } else if (!uri.includes('.')) {
        request.uri += '/index.html';
      }
      return request;
    }
  JS
}

resource "aws_cloudfront_function" "security_headers" {
  name    = "${local.name}-security-headers"
  runtime = "cloudfront-js-2.0"
  comment = "Add security and locale headers to viewer responses"
  publish = true
  code    = <<-JS
    function handler(event) {
      var response = event.response;
      var request = event.request;
      var h = response.headers;

      // Security headers
      h['x-content-type-options'] = { value: 'nosniff' };
      h['x-frame-options'] = { value: 'DENY' };
      h['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
      h['permissions-policy'] = { value: 'camera=(), microphone=(), geolocation=(self)' };
      h['vary'] = { value: 'Accept-Language' };
      h['strict-transport-security'] = { value: 'max-age=63072000; includeSubDomains; preload' };
      h['content-security-policy'] = { value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.amazonaws.com https://*.execute-api.eu-central-1.amazonaws.com wss://*.execute-api.eu-central-1.amazonaws.com; frame-ancestors 'none'" };

      // Pass locale cookie from request phase if set (use cookies API)
      if (request.headers['x-locale-cookie']) {
        var cookieStr = request.headers['x-locale-cookie'].value;
        var parts = cookieStr.split(';');
        var nameValue = parts[0].trim().split('=');
        response.cookies = response.cookies || {};
        response.cookies[nameValue[0]] = {
          value: nameValue[1],
          attributes: 'Path=/; Max-Age=31536000; SameSite=Lax'
        };
      }

      return response;
    }
  JS
}

resource "aws_cloudfront_cache_policy" "web_locale" {
  name        = "${local.name}-web-locale"
  comment     = "Cache policy with locale cookie for bilingual site"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "whitelist"
      cookies {
        items = ["locale"]
      }
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  aliases             = var.acm_certificate_arn != "" && var.frontend_domain != "" ? [var.frontend_domain] : []
  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = aws_cloudfront_cache_policy.web_locale.id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_router.arn
    }
    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  dynamic "viewer_certificate" {
    for_each = var.acm_certificate_arn != "" ? [1] : []
    content {
      acm_certificate_arn      = var.acm_certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.acm_certificate_arn != "" ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 10
  }

  tags = local.tags
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket.json
}

resource "aws_route53_record" "web" {
  count   = var.hosted_zone_id != "" && var.frontend_domain != "" ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.frontend_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_dynamodb_table" "data" {
  name         = "${local.name}-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  point_in_time_recovery { enabled = var.environment == "prod" }
  server_side_encryption { enabled = true }

  tags = local.tags
}


# ─── Legacy DynamoDB IAM for existing Python Lambda (smooth migration path) ──
resource "aws_cognito_user_pool" "users" {
  name                     = "${local.name}-users"
  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "MapsBridge Doğrulama Kodunuz"
    email_message        = "MapsBridge hesabınızı doğrulamak için kodunuz: {####}"
  }
  lambda_config {
    custom_message = aws_lambda_function.cognito_custom_message.arn
  }
  mfa_configuration = "OPTIONAL"
  sms_configuration {
    external_id    = "${local.name}-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
  }
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 3
  }
  schema {
    attribute_data_type = "String"
    name                = "name"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 120
    }
  }
  tags = local.tags
}

resource "aws_iam_role" "cognito_sms" {
  name               = "${local.name}-cognito-sms"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "cognito-idp.amazonaws.com" }, Action = "sts:AssumeRole" }] })
  tags               = local.tags
}

resource "aws_iam_role_policy" "cognito_sms" {
  name   = "${local.name}-cognito-sms"
  role   = aws_iam_role.cognito_sms.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = ["sns:Publish"], Resource = "*" }] })
}

resource "aws_cognito_user_pool_client" "web" {
  name            = "${local.name}-web"
  user_pool_id    = aws_cognito_user_pool.users.id
  generate_secret = false
  # Only profile fields used by this app are client-writable. In particular,
  # custom:role (read by backend admin authorization) must stay server-managed.
  write_attributes              = ["email", "name", "phone_number"]
  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 1
  id_token_validity             = 1
  refresh_token_validity        = 365
  token_validity_units {
    access_token  = "days"
    id_token      = "days"
    refresh_token = "days"
  }
}

# ─── Cognito Custom Message Trigger (MapsBridge HTML Transactional Emails) ───
resource "aws_iam_role" "cognito_custom_message" {
  name = "${local.name}-cognito-custom-message"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "cognito_custom_message_basic" {
  role       = aws_iam_role.cognito_custom_message.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "cognito_custom_message" {
  function_name    = "${local.name}-cognito-custom-message"
  role             = aws_iam_role.cognito_custom_message.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  filename         = "${path.module}/.build/lambdas/cognito-custom-message.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/lambdas/cognito-custom-message.zip")
  timeout          = 10
  memory_size      = 256
  tags             = local.tags
}

resource "aws_lambda_permission" "cognito_custom_message" {
  statement_id  = "AllowCognitoInvokeCustomMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_custom_message.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.users.arn
}

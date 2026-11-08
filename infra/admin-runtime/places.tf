# Yer verisi proxy'si (GET /ai/chat?op=places) — Google Places anahtarı + bütçe alarmı.
# Amazon Location izinleri: travel-rag.tf aws_iam_role_policy.place_research.

# Google Places API (New) sunucu anahtarı. Terraform yalnız boş secret'ı oluşturur;
# değer konsoldan girilir (asla kod/tfvars içinde değil). Değer yokken lambda
# "google_key_empty" ile Amazon sağlayıcısında kalır; admin kill switch varsayılan KAPALI.
resource "aws_secretsmanager_secret" "google_places_key" {
  name        = "${var.prefix}/google-places-key"
  description = "Google Places API (New) server key; yalnız ai lambda okur. Değer konsoldan girilir."
}
resource "aws_iam_role_policy" "google_places_secret" {
  name = "google-places-secret"
  role = aws_iam_role.domain["ai"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow", Action = ["secretsmanager:GetSecretValue"],
    Resource = aws_secretsmanager_secret.google_places_key.arn
  }] })
}

# Sağlayıcıların hepsi düştüğünde places.service.ts `{ msg: "places_unavailable" }` loglar.
resource "aws_cloudwatch_log_metric_filter" "places_unavailable" {
  name           = "${var.prefix}-places-unavailable"
  log_group_name = "/aws/lambda/${var.prefix}-ai"
  pattern        = "{ $.msg = \"places_unavailable\" }"
  metric_transformation {
    name      = "PlacesUnavailable"
    namespace = "MapsBridge/Places"
    value     = "1"
  }
}
resource "aws_cloudwatch_metric_alarm" "places_unavailable" {
  alarm_name          = "${var.prefix}-places-unavailable"
  namespace           = "MapsBridge/Places"
  metric_name         = "PlacesUnavailable"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 20
  comparison_operator = "GreaterThanThreshold"
  alarm_description   = "Yer servisi 5 dakikada 20'den fazla kez yanıt veremedi (Amazon/Google kotası, IAM ya da aylık Google bütçesi doldu)."
  treat_missing_data  = "notBreaching"
}

# Topluluk medya yüklemesi (GET /media/presign-upload → tarayıcıdan S3'e PUT).
# Bucket ana stack'te (infra/terraform/modules/storage aws_s3_bucket.media); burada
# yalnız tarayıcı PUT'u için CORS kuralı yönetilir.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = "${var.prefix}-storage-media-${var.account_id}"
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = [var.frontend_origin]
    allowed_headers = ["content-type"]
    max_age_seconds = 3000
  }
}

# Yüklenen görsellerin herkese açık okunduğu taban URL (ör. bir CloudFront alanı).
# Bugün medya bucket'ını sunan bir CloudFront origin'i yok; değer bilinmeden uydurulmaz.
# Boşken routes/community lambdalarına MEDIA_PUBLIC_BASE_URL yazılmaz: presign
# "Medya servisi yapılandırılmadı." döner, community görsel URL'lerini reddeder.
variable "media_public_base_url" {
  type        = string
  default     = ""
  description = "Public https base URL serving the media bucket (no trailing slash). Empty = media upload disabled."
  validation {
    condition     = var.media_public_base_url == "" || can(regex("^https://[^/]+(/.*)?[^/]$", var.media_public_base_url))
    error_message = "Expected an https URL without trailing slash, or empty."
  }
}

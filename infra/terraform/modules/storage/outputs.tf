output "media_bucket_id" {
  value = aws_s3_bucket.media.id
}

output "guides_bucket_id" {
  value = aws_s3_bucket.guides.id
}

output "analytics_bucket_id" {
  value = aws_s3_bucket.analytics.id
}

output "athena_bucket_id" {
  value = aws_s3_bucket.athena.id
}

output "guides_bucket_arn" {
  value = aws_s3_bucket.guides.arn
}

output "media_bucket_arn" {
  value = aws_s3_bucket.media.arn
}

output "analytics_bucket_arn" {
  value = aws_s3_bucket.analytics.arn
}

output "athena_bucket_arn" {
  value = aws_s3_bucket.athena.arn
}


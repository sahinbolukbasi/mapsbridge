output "aurora_cluster_arn" {
  value = aws_rds_cluster.aurora.arn
}

output "aurora_endpoint" {
  value     = aws_rds_cluster.aurora.endpoint
  sensitive = true
}

output "aurora_writer_endpoint" {
  value     = aws_rds_cluster.aurora.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_serverless_cache.redis.endpoint[0].address
  sensitive = true
}

output "redis_primary_endpoint" {
  value     = aws_elasticache_serverless_cache.redis.endpoint[0].address
  sensitive = true
}
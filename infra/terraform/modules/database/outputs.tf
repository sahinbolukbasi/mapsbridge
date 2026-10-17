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
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "redis_primary_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "aurora_master_secret_arn" {
  description = "Secrets Manager secret ARN for Aurora master password (managed by RDS)"
  value       = aws_rds_cluster.aurora.master_user_secret[0].secret_arn
  sensitive   = true
}

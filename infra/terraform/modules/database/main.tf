# MapsBridge Database Module — Aurora Serverless v2 (PostgreSQL + PostGIS) + ElastiCache (Redis)
# FinOps: Aurora min_capacity=0.0 (gerçek idle pause), ElastiCache provisioned t4g.small (~$25/ay vs Serverless $91/ay)

locals {
  substack_name = "${var.name}-db"
}

# ─── Aurora Serverless v2 (PostgreSQL + PostGIS) ──────────────────────────
resource "aws_rds_cluster_parameter_group" "aurora" {
  name        = "${local.substack_name}-pg"
  family      = "aurora-postgresql17"
  description = "MapsBridge Aurora PostgreSQL 17 with PostGIS"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  tags = var.tags
}

resource "aws_rds_cluster" "aurora" {
  cluster_identifier              = local.substack_name
  engine                          = "aurora-postgresql"
  engine_mode                     = "provisioned"
  engine_version                  = "17.4"
  database_name                   = "mapsbridge"
  master_username                 = var.db_username
  manage_master_user_password     = true
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.aurora.name
  vpc_security_group_ids          = [var.aurora_security_group_id]
  db_subnet_group_name            = aws_db_subnet_group.aurora.name
  storage_encrypted               = true
  backup_retention_period         = var.environment == "prod" ? 7 : 1
  preferred_backup_window         = "03:00-04:00"
  copy_tags_to_snapshot           = true
  deletion_protection             = var.environment == "prod"
  skip_final_snapshot             = var.environment != "prod"

  serverlessv2_scaling_configuration {
    min_capacity = 0.0   # PostgreSQL 17: gerçek idle pause, zemin ücret yok
    max_capacity = 4.0
  }

  tags = var.tags
}

resource "aws_db_parameter_group" "aurora_instance" {
  name        = "${local.substack_name}-instance-pg"
  family      = "aurora-postgresql17"
  description = "MapsBridge Aurora PostgreSQL 17 instance parameters"
  tags        = var.tags
}

resource "aws_rds_cluster_instance" "aurora" {
  count                      = 1   # Tek instance yeterli; reader yük gerekirse ekle
  identifier                 = "${local.substack_name}-${count.index}"
  cluster_identifier         = aws_rds_cluster.aurora.id
  instance_class             = var.aurora_instance_class
  engine                     = aws_rds_cluster.aurora.engine
  engine_version             = aws_rds_cluster.aurora.engine_version
  db_parameter_group_name    = aws_db_parameter_group.aurora_instance.name
  db_subnet_group_name       = aws_db_subnet_group.aurora.name
  publicly_accessible        = false
  monitoring_interval        = 0
  auto_minor_version_upgrade = true
  tags                       = var.tags
}

resource "aws_db_subnet_group" "aurora" {
  name        = local.substack_name
  subnet_ids  = var.private_subnet_ids
  description = "MapsBridge Aurora subnets"
  tags        = var.tags
}

# ─── ElastiCache Provisioned (Redis 7.1, cache.t4g.small) ─────────────────
# Serverless $91/ay zemin → Provisioned $25/ay (~$66/ay tasarruf)
# t4g.small: token rate-limit, route segment cache, session cache için yeterli
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.substack_name}-redis"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.substack_name}-redis"
  description                = "MapsBridge token rate-limit, route segment cache, session cache"
  node_type                  = "cache.t4g.small"
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  engine_version             = "7.1"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [var.redis_security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"
  apply_immediately          = var.environment != "prod"

  tags = var.tags
}

# ─── SSM Parameter Store for connection strings ───────────────────────────
resource "aws_ssm_parameter" "aurora_endpoint" {
  name  = "/mapsbridge/${var.environment}/aurora/endpoint"
  type  = "SecureString"
  value = aws_rds_cluster.aurora.endpoint
  tags  = var.tags
}

resource "aws_ssm_parameter" "aurora_writer" {
  name  = "/mapsbridge/${var.environment}/aurora/writer"
  type  = "SecureString"
  value = aws_rds_cluster.aurora.endpoint
  tags  = var.tags
}

resource "aws_ssm_parameter" "redis_endpoint" {
  name  = "/mapsbridge/${var.environment}/redis/endpoint"
  type  = "SecureString"
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
  tags  = var.tags
}

# MapsBridge Database Module — Aurora Serverless v2 (PostgreSQL + PostGIS) + ElastiCache Serverless (Redis)
# Well-Architected: Cost optimized — Aurora Serverless v2 scales to zero when idle
# ElastiCache Serverless — no node management, pay per request

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
  master_password                 = var.db_password
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
    min_capacity = 0.5
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
  count                      = var.environment == "prod" ? 2 : 1
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

# ─── ElastiCache Serverless (Redis) ───────────────────────────────────────
# Serverless mode: no nodes to manage, pay-per-request, auto-scales to zero
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.substack_name}-redis"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_elasticache_serverless_cache" "redis" {
  name        = "${local.substack_name}-redis"
  engine      = "redis"
  description = "MapsBridge token rate-limit, route segment cache, session cache"

  cache_usage_limits {
    data_storage {
      maximum = var.redis_max_data_storage_gb
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = var.redis_max_ecpu_per_second
    }
  }

  security_group_ids = [var.redis_security_group_id]
  subnet_ids         = var.private_subnet_ids

  # KMS encryption at rest
  kms_key_id = var.kms_key_arn

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
  value = aws_elasticache_serverless_cache.redis.endpoint[0].address
  tags  = var.tags
}
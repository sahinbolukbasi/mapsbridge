# MapsBridge VPC — Private subnets for Aurora, ElastiCache, Lambda (via VPC Config)
# NAT Gateway omitted for cost (Lambda uses VPC endpoints + S3 Gateway endpoint)
# Well-Architected: Cost optimized — single AZ for dev, multi-AZ for prod

locals {
  az_count = var.environment == "prod" ? 2 : 1
  azs      = slice(data.aws_availability_zones.available.names, 0, local.az_count)
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "${var.name}-vpc", Project = var.project, Environment = var.environment }
}

resource "aws_subnet" "private" {
  count             = local.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = local.azs[count.index]
  tags              = { Name = "${var.name}-private-${count.index}", Project = var.project, Environment = var.environment }
}

resource "aws_security_group" "aurora" {
  name        = "${var.name}-aurora-sg"
  description = "Allow inbound from Lambda VPC config"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name}-aurora-sg", Project = var.project, Environment = var.environment }
}

resource "aws_security_group" "redis" {
  name        = "${var.name}-redis-sg"
  description = "Allow inbound from Lambda VPC config"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name}-redis-sg", Project = var.project, Environment = var.environment }
}

resource "aws_security_group" "lambda" {
  name        = "${var.name}-lambda-sg"
  description = "Allow outbound to Aurora, Redis, and HTTPS via VPC endpoints"
  vpc_id      = aws_vpc.this.id
  tags        = { Name = "${var.name}-lambda-sg", Project = var.project, Environment = var.environment }
}

# HTTPS — VPC endpoints, external APIs (Bedrock, SSM, CloudWatch, etc.)
resource "aws_vpc_security_group_egress_rule" "lambda_https" {
  security_group_id = aws_security_group.lambda.id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "HTTPS to VPC endpoints and external AWS services"
}

# PostgreSQL — Aurora only within VPC
resource "aws_vpc_security_group_egress_rule" "lambda_postgres" {
  security_group_id = aws_security_group.lambda.id
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
  cidr_ipv4         = var.vpc_cidr
  description       = "PostgreSQL to Aurora within VPC"
}

# Redis — ElastiCache only within VPC
resource "aws_vpc_security_group_egress_rule" "lambda_redis" {
  security_group_id = aws_security_group.lambda.id
  from_port         = 6379
  to_port           = 6379
  ip_protocol       = "tcp"
  cidr_ipv4         = var.vpc_cidr
  description       = "Redis to ElastiCache within VPC"
}

# VPC Gateway Endpoint for S3 (free, no NAT needed)
resource "aws_vpc_endpoint" "s3" {
  vpc_id          = aws_vpc.this.id
  service_name    = "com.amazonaws.${var.aws_region}.s3"
  route_table_ids = [aws_route_table.private.id]
  tags            = { Name = "${var.name}-s3-gateway", Project = var.project, Environment = var.environment }
}

# VPC Gateway Endpoint for DynamoDB (free, no NAT needed)
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id          = aws_vpc.this.id
  service_name    = "com.amazonaws.${var.aws_region}.dynamodb"
  route_table_ids = [aws_route_table.private.id]
  tags            = { Name = "${var.name}-dynamodb-gateway", Project = var.project, Environment = var.environment }
}

# VPC Interface Endpoint for Secrets Manager (admin lambda reads secrets)
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.lambda.id]
  private_dns_enabled = true
  tags                = { Name = "${var.name}-secretsmanager-vpce", Project = var.project, Environment = var.environment }
}

# VPC Interface Endpoints for services Lambda needs (no NAT)
resource "aws_vpc_endpoint" "bedrock" {
  count               = var.enable_bedrock ? 1 : 0
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.bedrock-runtime"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.lambda.id]
  private_dns_enabled = true
  tags                = { Name = "${var.name}-bedrock-vpce", Project = var.project, Environment = var.environment }
}

resource "aws_vpc_endpoint" "monitoring" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.monitoring" # CloudWatch Logs
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.lambda.id]
  private_dns_enabled = true
  tags                = { Name = "${var.name}-logs-vpce", Project = var.project, Environment = var.environment }
}

resource "aws_vpc_endpoint" "sqs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.sqs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.lambda.id]
  private_dns_enabled = true
  tags                = { Name = "${var.name}-sqs-vpce", Project = var.project, Environment = var.environment }
}

# Private route table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-private-rt", Project = var.project, Environment = var.environment }
}

resource "aws_route_table_association" "private" {
  count          = local.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Security group ingress rules
resource "aws_vpc_security_group_ingress_rule" "aurora_lambda" {
  security_group_id            = aws_security_group.aurora.id
  referenced_security_group_id = aws_security_group.lambda.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Lambda to Aurora PostgreSQL"
}

resource "aws_vpc_security_group_ingress_rule" "redis_lambda" {
  security_group_id            = aws_security_group.redis.id
  referenced_security_group_id = aws_security_group.lambda.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  description                  = "Lambda to ElastiCache Redis"
}

# ─── VPC Flow Logs ─────────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/aws/vpc/${var.name}/flow-logs"
  retention_in_days = 30
  tags              = { Name = "${var.name}-flow-logs", Project = var.project, Environment = var.environment }
}

resource "aws_iam_role" "flow_logs" {
  name = "${var.name}-vpc-flow-logs"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = { Name = "${var.name}-vpc-flow-logs", Project = var.project, Environment = var.environment }
}

resource "aws_iam_role_policy" "flow_logs" {
  name = "${var.name}-vpc-flow-logs"
  role = aws_iam_role.flow_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "${aws_cloudwatch_log_group.flow_logs.arn}:*"
    }]
  })
}

resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_logs.arn
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  tags            = { Name = "${var.name}-flow-logs", Project = var.project, Environment = var.environment }
}
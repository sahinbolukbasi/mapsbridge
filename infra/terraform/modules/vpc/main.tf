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
  description = "Allow outbound to Aurora, Redis, internet via endpoints"
  vpc_id      = aws_vpc.this.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "${var.name}-lambda-sg", Project = var.project, Environment = var.environment }
}

# VPC Gateway Endpoint for S3 (free, no NAT needed)
resource "aws_vpc_endpoint" "s3" {
  vpc_id          = aws_vpc.this.id
  service_name    = "com.amazonaws.${var.aws_region}.s3"
  route_table_ids = [aws_route_table.private.id]
  tags            = { Name = "${var.name}-s3-gateway", Project = var.project, Environment = var.environment }
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
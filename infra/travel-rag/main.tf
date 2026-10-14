terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
provider "aws" {
  region              = "eu-central-1"
  allowed_account_ids = ["996270854731"]
  default_tags { tags = { Project = "adreskopru", Workload = "travel-ai", Component = "knowledge", Environment = "prod" } }
}
data "aws_caller_identity" "current" {}
locals {
  name      = "adreskopru-prod-travel"
  embedding = "arn:aws:bedrock:eu-central-1::foundation-model/amazon.titan-embed-text-v2:0"
}
resource "aws_s3_bucket" "documents" {
  bucket = "${local.name}-sources-${data.aws_caller_identity.current.account_id}"
  lifecycle { prevent_destroy = true }
}
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3vectors_vector_bucket" "travel" {
  vector_bucket_name = "${local.name}-vectors"
  lifecycle { prevent_destroy = true }
}
resource "aws_s3vectors_index" "travel" {
  vector_bucket_name = aws_s3vectors_vector_bucket.travel.vector_bucket_name
  index_name         = "travel-v1"
  data_type          = "float32"
  dimension          = 1024
  distance_metric    = "cosine"
  metadata_configuration {
    non_filterable_metadata_keys = ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"]
  }
  lifecycle { prevent_destroy = true }
}
resource "aws_iam_role" "knowledge" {
  name = "${local.name}-knowledge"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Principal = { Service = "bedrock.amazonaws.com" }, Action = "sts:AssumeRole",
    Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:bedrock:eu-central-1:${data.aws_caller_identity.current.account_id}:knowledge-base/*" } }
  }] })
}
resource "aws_iam_role_policy" "knowledge" {
  role = aws_iam_role.knowledge.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = local.embedding },
    { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.documents.arn },
    { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${aws_s3_bucket.documents.arn}/published/*" },
    { Effect = "Allow", Action = ["s3vectors:GetIndex", "s3vectors:QueryVectors", "s3vectors:GetVectors", "s3vectors:PutVectors", "s3vectors:DeleteVectors"], Resource = aws_s3vectors_index.travel.index_arn }
  ] })
}
resource "aws_bedrockagent_knowledge_base" "travel" {
  name     = local.name
  role_arn = aws_iam_role.knowledge.arn
  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = local.embedding
      embedding_model_configuration {
        bedrock_embedding_model_configuration {
          dimensions          = 1024
          embedding_data_type = "FLOAT32"
        }
      }
    }
  }
  storage_configuration {
    type = "S3_VECTORS"
    s3_vectors_configuration { index_arn = aws_s3vectors_index.travel.index_arn }
  }
  depends_on = [aws_iam_role_policy.knowledge]
}
resource "aws_bedrockagent_data_source" "travel" {
  name                 = "approved-travel-documents"
  knowledge_base_id    = aws_bedrockagent_knowledge_base.travel.id
  data_deletion_policy = "DELETE"
  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn         = aws_s3_bucket.documents.arn
      inclusion_prefixes = ["published/"]
    }
  }
  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = "FIXED_SIZE"
      fixed_size_chunking_configuration {
        max_tokens         = 400
        overlap_percentage = 15
      }
    }
  }
}
output "knowledge_base_id" { value = aws_bedrockagent_knowledge_base.travel.id }
output "knowledge_base_arn" { value = aws_bedrockagent_knowledge_base.travel.arn }
output "data_source_id" { value = aws_bedrockagent_data_source.travel.data_source_id }
output "source_bucket" { value = aws_s3_bucket.documents.id }

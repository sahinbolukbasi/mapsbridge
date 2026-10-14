# MapsBridge Analytics Module — Kinesis Firehose → S3 + Athena
# User events (route preview, click, purchase) → Firehose → S3 → Athena
# Well-Architected: Performance — Firehose buffers near-real-time without
# managing servers; Athena queries pay-per-scan for ad-hoc admin analytics

locals {
  substack_name = "${var.name}-analytics"
}

# ─── Kinesis Firehose Delivery Stream ─────────────────────────────────────
resource "aws_kinesis_firehose_delivery_stream" "events" {
  name        = "${local.substack_name}-events"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.firehose.arn
    bucket_arn          = var.analytics_bucket_arn
    prefix              = "raw/events/dt=!{timestamp:yyyy-MM-dd}/"
    error_output_prefix = "raw/errors/!{firehose:error-output-type}/"
    buffering_interval  = 300 # 5 min buffer (cost efficient)
    buffering_size      = 64  # 64 MB min when data format conversion is enabled

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose.name
      log_stream_name = "s3-delivery"
    }

    data_format_conversion_configuration {
      input_format_configuration {
        deserializer {
          open_x_json_ser_de {}
        }
      }
      output_format_configuration {
        serializer {
          parquet_ser_de {}
        }
      }
      schema_configuration {
        role_arn      = aws_iam_role.firehose.arn
        database_name = var.glue_database_name
        table_name    = "events"
      }
    }
  }

  tags = var.tags
}

# ─── Glue Database & Table for Athena ─────────────────────────────────────
resource "aws_glue_catalog_database" "analytics" {
  name = var.glue_database_name
  tags = var.tags
}

resource "aws_glue_catalog_table" "events" {
  name          = "events"
  database_name = aws_glue_catalog_database.analytics.name
  table_type    = "EXTERNAL_TABLE"

  storage_descriptor {
    location      = "s3://${var.analytics_bucket_id}/raw/events/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
    columns {
      name = "dt"
      type = "string"
    }
    columns {
      name = "userId"
      type = "string"
    }
    columns {
      name = "action"
      type = "string"
    }
    columns {
      name = "timestamp"
      type = "bigint"
    }
    columns {
      name = "metadata"
      type = "string"
    }
  }

  partition_keys {
    name = "dt"
    type = "string"
  }

}

# Partition projection (no need to run MSCK REPAIR TABLE)
resource "aws_glue_catalog_table" "events_partitioned" {
  count         = var.environment == "prod" ? 1 : 0
  name          = "events_partitioned"
  database_name = aws_glue_catalog_database.analytics.name
  table_type    = "EXTERNAL_TABLE"

  storage_descriptor {
    location      = "s3://${var.analytics_bucket_id}/raw/events/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
    columns {
      name = "userId"
      type = "string"
    }
    columns {
      name = "action"
      type = "string"
    }
    columns {
      name = "timestamp"
      type = "bigint"
    }
    columns {
      name = "metadata"
      type = "string"
    }
  }

  partition_keys {
    name = "dt"
    type = "string"
  }

  parameters = {
    "projection.enabled"          = "true"
    "projection.dt.type"          = "date"
    "projection.dt.range"         = "2026-01-01,NOW"
    "projection.dt.format"        = "yyyy-MM-dd"
    "projection.dt.interval"      = "1"
    "projection.dt.interval.unit" = "DAYS"
    "storage.location.template"   = "s3://${var.analytics_bucket_id}/raw/events/dt=$${dt}/"
  }

}

# ─── Athena Workgroup ─────────────────────────────────────────────────────
resource "aws_athena_workgroup" "analytics" {
  name = "${local.substack_name}-workgroup"
  configuration {
    result_configuration {
      output_location = "s3://${var.athena_bucket_id}/athena-results/"
    }
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = var.environment == "prod"
    bytes_scanned_cutoff_per_query     = 1073741824 # 1 GB max per query
  }
  tags = var.tags
}

# ─── IAM ──────────────────────────────────────────────────────────────────
resource "aws_iam_role" "firehose" {
  name = "${local.substack_name}-firehose"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy" "firehose_s3" {
  name = "s3-write"
  role = aws_iam_role.firehose.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:AbortMultipartUpload", "s3:GetBucketLocation", "s3:GetObject", "s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:PutObject"]
        Resource = [var.analytics_bucket_arn, "${var.analytics_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["glue:GetTable", "glue:GetTableVersion", "glue:GetTableVersions"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:PutLogEvents", "logs:CreateLogStream", "logs:DescribeLogStreams"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "firehose" {
  name              = "/aws/firehose/${local.substack_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7
  tags              = var.tags
}

# Lambda → Firehose: PutRecord permissions via IAM policy (attached to Lambda role)
resource "aws_iam_role_policy" "lambda_firehose" {
  count = var.lambda_role_arn != "" ? 1 : 0
  name  = "firehose-put"
  role  = var.lambda_role_name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["firehose:PutRecord", "firehose:PutRecordBatch"]
      Resource = aws_kinesis_firehose_delivery_stream.events.arn
    }]
  })
}
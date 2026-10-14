output "firehose_stream_name" {
  value = aws_kinesis_firehose_delivery_stream.events.name
}

output "glue_database_name" {
  value = aws_glue_catalog_database.analytics.name
}

output "athena_workgroup" {
  value = aws_athena_workgroup.analytics.name
}
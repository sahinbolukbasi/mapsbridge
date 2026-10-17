# MapsBridge AI — Bedrock integration via the API module's "routes" domain.
# The Bedrock model ID is passed to the module as bedrock_model_id; the
# routes Lambda wraps the model call with the token rate-limit middleware.
#
# Enable Bedrock access: aws bedrock put-model-invocation-logging-configuration
# + request model access for anthropic.claude-3-haiku in the AWS console.


# Bedrock Knowledge Base — RAG over regional travel data
# (created via console or the bedrock module; placeholder wiring here)
resource "aws_bedrockagent_knowledge_base" "travel" {
  count = var.enable_bedrock && var.opensearch_collection_arn != "" ? 1 : 0

  name     = "${local.name}-travel-kb"
  role_arn = aws_iam_role.bedrock_kb[0].arn

  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
    }
  }

  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"
    opensearch_serverless_configuration {
      collection_arn    = var.opensearch_collection_arn
      vector_index_name = "travel-index"
      field_mapping {
        metadata_field = "metadata"
        text_field     = "text"
      }
    }
  }

  tags = local.tags
}

resource "aws_iam_role" "bedrock_kb" {
  count = var.enable_bedrock ? 1 : 0

  name = "${local.name}-bedrock-kb"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "bedrock_kb" {
  count = var.enable_bedrock ? 1 : 0

  name = "bedrock-kb-access"
  role = aws_iam_role.bedrock_kb[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["aoss:APIAccessAll"]
        Resource = var.opensearch_collection_arn
      }
    ]
  })
}

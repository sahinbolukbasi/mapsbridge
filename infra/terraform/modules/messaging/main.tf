# MapsBridge Messaging Module — API Gateway WebSocket API + Lambda
# Real-time 1:1 chat with connection table in DynamoDB
# (WebSocket connections are ephemeral; DynamoDB is cheaper and lower-latency
#  than Aurora for connection state)
# Well-Architected: Serverless-first, cost optimized — DynamoDB on-demand

locals {
  substack_name = "${var.name}-ws"
}

# ─── Connection Table (session state) ─────────────────────────────────────
resource "aws_dynamodb_table" "connections" {
  name         = "${local.substack_name}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"
  attribute {
    name = "connectionId"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  server_side_encryption { enabled = true }
  tags = var.tags
}

# ─── WebSocket API ────────────────────────────────────────────────────────
resource "aws_apigatewayv2_api" "websocket" {
  name                       = local.substack_name
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  tags                       = var.tags
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

# Lambda functions
resource "aws_lambda_function" "onconnect" {
  function_name    = "${local.substack_name}-onconnect"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = var.onconnect_zip
  source_code_hash = filebase64sha256(var.onconnect_zip)
  timeout          = 10
  memory_size      = 128
  environment {
    variables = {
      CONNECTIONS_TABLE    = aws_dynamodb_table.connections.name
      DYNAMODB_TABLE       = var.messages_table_name
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_CLIENT_ID    = var.cognito_client_id
    }
  }
  tags = var.tags
}

resource "aws_lambda_function" "onmessage" {
  function_name    = "${local.substack_name}-onmessage"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = var.onmessage_zip
  source_code_hash = filebase64sha256(var.onmessage_zip)
  timeout          = 10
  memory_size      = 256
  environment {
    variables = {
      CONNECTIONS_TABLE      = aws_dynamodb_table.connections.name
      MESSAGES_TABLE         = var.messages_table_name
      WEBSOCKET_API_ENDPOINT = aws_apigatewayv2_api.websocket.api_endpoint
    }
  }
  tags = var.tags
}

resource "aws_lambda_function" "ondisconnect" {
  function_name    = "${local.substack_name}-ondisconnect"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = var.ondisconnect_zip
  source_code_hash = filebase64sha256(var.ondisconnect_zip)
  timeout          = 10
  memory_size      = 128
  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }
  tags = var.tags
}

# ─── IAM ──────────────────────────────────────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "${local.substack_name}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamo" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:UpdateItem"]
        Resource = [
          aws_dynamodb_table.connections.arn,
          "${aws_dynamodb_table.connections.arn}/index/userId-index",
          var.messages_table_arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "arn:aws:execute-api:${var.aws_region}:*:${aws_apigatewayv2_api.websocket.id}/*/*"
      }
    ]
  })
}

# ─── Routes ───────────────────────────────────────────────────────────────
resource "aws_apigatewayv2_integration" "onconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.onconnect.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "onmessage" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.onmessage.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "ondisconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ondisconnect.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.onconnect.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.onmessage.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ondisconnect.id}"
}

# Lambda permissions
resource "aws_lambda_permission" "connect" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.onconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$connect"
}

resource "aws_lambda_permission" "message" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.onmessage.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$default"
}

resource "aws_lambda_permission" "disconnect" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ondisconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/$disconnect"
}

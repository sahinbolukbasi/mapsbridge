output "api_gateway_id" {
  value = aws_apigatewayv2_api.http.id
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "api_gateway_execution_arn" {
  value = aws_apigatewayv2_api.http.execution_arn
}

output "lambda_function_arns" {
  value = { for k, f in aws_lambda_function.domain : k => f.arn }
}

output "lambda_function_names" {
  value = { for k, f in aws_lambda_function.domain : k => f.function_name }
}

output "lambda_role_arns" {
  value = { for k, r in aws_iam_role.lambda : k => r.arn }
}

output "lambda_role_names" {
  value = { for k, r in aws_iam_role.lambda : k => r.name }
}

output "http_stage_name" {
  value = aws_apigatewayv2_stage.http.name
}

output "http_stage_arn" {
  value = "arn:aws:apigateway:${var.aws_region}::/apis/${aws_apigatewayv2_api.http.id}/stages/${aws_apigatewayv2_stage.http.name}"
}
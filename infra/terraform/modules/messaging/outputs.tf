output "websocket_url" {
  value = aws_apigatewayv2_api.websocket.api_endpoint
}

output "websocket_stage" {
  value = aws_apigatewayv2_stage.websocket.name
}

output "connections_table" {
  value = aws_dynamodb_table.connections.name
}

output "websocket_api_id" {
  value = aws_apigatewayv2_api.websocket.id
}